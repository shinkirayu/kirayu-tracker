/**
 * Embedded copy of ../../../src/MurderMystery2Tracker.lua with CONFIG.Endpoint
 * left as a placeholder. Kept in sync manually — if the tracker changes, copy
 * the new source in here too (Vercel builds with Root Directory=dashboard, so
 * this can't just import the file from outside the dashboard/ folder).
 */
export const TRACKER_VERSION = "2";

const TRACKER_TEMPLATE = String.raw`--!nonstrict
--[[
	Murder Mystery 2 - Account Data Tracker (v1)
	---------------------------------------------
	Reads the LocalPlayer's own account state from MM2's own client APIs and
	reports changes to an external dashboard.

	Pairs with the ingest.pb.js hook in mm2-server/pb_hooks: set CONFIG.Endpoint to
	  https://<your-mm2-server-host>/api/mm2/ingest?key=<your-tracker-token>

	Data sources (all verified against a live client before writing this):
	  * ReplicatedStorage.Remotes.Extras.GetFullInventory:InvokeServer(username)
	    is the same RemoteFunction MM2's own "View Profile" UI uses to show
	    *any* player's inventory — it returns the full save table read-only
	    (CoinBag, XP/NewXP, Prestige, and per-category Owned/Equipped tables).
	    This is a genuine network round trip (unlike a push-replicated value),
	    so don't drop FlushInterval much below the default.
	  * ReplicatedStorage.Database.Sync.{Item,Pets,Effects,Toys,Emotes,Radios,Materials}
	    are the static item catalogs used to enrich owned-item keys with a
	    display name / rarity / image. Materials also carries a \`Currency\`
	    flag on event-currency entries (e.g. Summer 2026's "Shells") — since
	    the catalog key changes every event (SummerKey2026, HalloweenKey2025,
	    ...), reporting the whole owned Materials map generically means a new
	    event's currency shows up on its own, no tracker changes needed.
	  * ReplicatedStorage.Modules.LevelModule exposes GetLevel(xp) and
	    GetProgressToNextLevel(xp) — used directly instead of re-implementing
	    the XP curve.
	  * Round/role state has no simple query API, so it's inferred
	    best-effort by passively listening to Remotes.Gameplay events the
	    client already receives (RoundStart/GameOver/LoadingMap/RoleSelect) —
	    nothing is invoked, only observed.
]]

--// ---------------------------------------------------------------------------
--// Services
--// ---------------------------------------------------------------------------
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")

local LocalPlayer = Players.LocalPlayer

--// ---------------------------------------------------------------------------
--// Configuration
--// ---------------------------------------------------------------------------
local CONFIG = {
	-- Where to send updates. This is your personal tracker endpoint — do not
	-- share it, anyone with it can post data that gets attributed to you.
	Endpoint = "__INGEST_ENDPOINT__",

	-- Minimum seconds between checking for changes. Each check is a real
	-- GetFullInventory server round trip (not a cheap local read), so this
	-- is deliberately less aggressive than a push-replicated tracker.
	FlushInterval = 30.0,

	-- Even with nothing changed, send a heartbeat this often so the dashboard
	-- doesn't show you as offline while you're actually still in-game.
	HeartbeatInterval = 90.0,

	-- Verbose discovery / diff logging. Off by default — flip to true locally
	-- when debugging; shipped scripts shouldn't spam a normal user's console.
	Debug = false,
}

--// ---------------------------------------------------------------------------
--// Logger
--// ---------------------------------------------------------------------------
local Log = {}
do
	local PREFIX = "[MM2-Tracker]"
	function Log.info(...)
		if CONFIG.Debug then
			print(PREFIX, ...)
		end
	end
	function Log.found(what, where)
		if CONFIG.Debug then
			print(PREFIX, "FOUND", what, "->", where)
		end
	end
	function Log.missing(what)
		if CONFIG.Debug then
			warn(PREFIX, "MISSING", what)
		end
	end
	function Log.warn(...)
		warn(PREFIX, ...)
	end
end

--// ---------------------------------------------------------------------------
--// Utility helpers (all fail-safe)
--// ---------------------------------------------------------------------------
local Util = {}

function Util.safe(fn, fallback)
	local ok, result = pcall(fn)
	if ok then
		return result
	end
	return fallback
end

-- Coerce arbitrary Roblox values into JSON-friendly primitives.
function Util.jsonSafe(v)
	local t = typeof(v)
	if t == "number" or t == "string" or t == "boolean" or t == "nil" then
		return v
	elseif t == "EnumItem" then
		return tostring(v)
	elseif t == "Vector3" then
		return { x = v.X, y = v.Y, z = v.Z }
	elseif t == "Vector2" then
		return { x = v.X, y = v.Y }
	elseif t == "Color3" then
		return { r = v.R, g = v.G, b = v.B }
	elseif t == "Instance" then
		return v.Name
	elseif t == "table" then
		return v -- handled by deepJsonSafe
	end
	return tostring(v)
end

-- Recursively copy a table into a plain, JSON-safe table.
function Util.deepJsonSafe(v)
	if typeof(v) ~= "table" then
		return Util.jsonSafe(v)
	end
	local out = {}
	for k, val in pairs(v) do
		out[k] = Util.deepJsonSafe(val)
	end
	return out
end

-- Deep, order-independent equality for the plain tables we build.
function Util.deepEqual(a, b)
	if a == b then
		return true
	end
	if typeof(a) ~= "table" or typeof(b) ~= "table" then
		return false
	end
	for k, v in pairs(a) do
		if not Util.deepEqual(v, b[k]) then
			return false
		end
	end
	for k in pairs(b) do
		if a[k] == nil then
			return false
		end
	end
	return true
end

function Util.deepCopy(v)
	if typeof(v) ~= "table" then
		return v
	end
	local out = {}
	for k, val in pairs(v) do
		out[k] = Util.deepCopy(val)
	end
	return out
end

--// ---------------------------------------------------------------------------
--// Static game data — item catalogs + the level curve, used to enrich raw
--// owned-item keys with a display name / rarity / image / level. All
--// optional: if the game restructures these, trackers below fall back to
--// raw values instead of erroring.
--// ---------------------------------------------------------------------------
local StaticInfo = {}

local function tryRequireChild(parent, name)
	if not parent then
		Log.missing("static info: " .. name .. " (parent missing)")
		return nil
	end
	local ok, mod = pcall(function()
		local child = parent:WaitForChild(name, 15)
		return require(child)
	end)
	if ok then
		Log.found("static info", name)
		return mod
	end
	Log.missing("static info: " .. name)
	return nil
end

function StaticInfo.load()
	local sync = Util.safe(function()
		return ReplicatedStorage:WaitForChild("Database", 15):WaitForChild("Sync", 15)
	end)
	if not sync then
		Log.missing("Database.Sync")
	end
	-- The weapon catalog module is named "Item" in-game; Knives and Guns are
	-- both entries in it, distinguished by each entry's own ItemType field.
	StaticInfo.Weapons = tryRequireChild(sync, "Item")
	StaticInfo.Pets = tryRequireChild(sync, "Pets")
	StaticInfo.Effects = tryRequireChild(sync, "Effects")
	StaticInfo.Toys = tryRequireChild(sync, "Toys")
	StaticInfo.Emotes = tryRequireChild(sync, "Emotes")
	StaticInfo.Radios = tryRequireChild(sync, "Radios")
	-- Crafting materials + rotating event currencies (e.g. Summer 2026's
	-- "Shells", keyed SummerKey2026) — a \`Currency\` flag on the catalog
	-- entry distinguishes the two.
	StaticInfo.Materials = tryRequireChild(sync, "Materials")

	local modules = Util.safe(function()
		return ReplicatedStorage:WaitForChild("Modules", 15)
	end)
	if not modules then
		Log.missing("Modules")
	end
	StaticInfo.LevelModule = tryRequireChild(modules, "LevelModule")
end

--// ---------------------------------------------------------------------------
--// Presence (best-effort round/role state)
--// MM2 has no simple "get my current round state" query, so this listens
--// passively to remotes the client already receives and caches the latest
--// value — nothing here ever invokes anything server-side.
--// ---------------------------------------------------------------------------
local Presence = {
	InRound = false,
	Map = nil,
	Role = nil,
}

local function connectPresenceEvents()
	local gameplay = Util.safe(function()
		return ReplicatedStorage:WaitForChild("Remotes", 15):WaitForChild("Gameplay", 15)
	end)
	if not gameplay then
		Log.missing("Remotes.Gameplay (presence tracking disabled)")
		return
	end

	local function onEvent(remoteName, handler)
		local remote = gameplay:FindFirstChild(remoteName)
		if not remote then
			Log.missing("Remotes.Gameplay." .. remoteName)
			return
		end
		Util.safe(function()
			remote.OnClientEvent:Connect(function(...)
				local args = { ... }
				Util.safe(function()
					handler(table.unpack(args))
				end)
			end)
		end)
	end

	onEvent("LoadingMap", function(mapName)
		Presence.Map = tostring(mapName)
		Presence.InRound = true
	end)
	onEvent("RoundStart", function()
		Presence.InRound = true
	end)
	onEvent("GameOver", function()
		Presence.InRound = false
		Presence.Role = nil
		Presence.Map = nil
	end)
	onEvent("RoleSelect", function(role)
		if role ~= nil then
			Presence.Role = tostring(role)
		end
	end)
	onEvent("ShowRoleSelectNew", function(role)
		if role ~= nil then
			Presence.Role = tostring(role)
		end
	end)

	Log.found("presence events", "Remotes.Gameplay")
end

--// ---------------------------------------------------------------------------
--// Trackers
--// ---------------------------------------------------------------------------
local Trackers = {}

-- The one live network read per poll: MM2's own "view profile" API, called
-- with our own username. Returns the full save table (currencies, level,
-- prestige, every per-category owned/equipped item map) or nil on failure.
function Trackers.profile()
	local ok, result = pcall(function()
		return ReplicatedStorage.Remotes.Extras.GetFullInventory:InvokeServer(LocalPlayer.Name)
	end)
	if ok and typeof(result) == "table" then
		return result
	end
	Log.missing("GetFullInventory result")
	return nil
end

function Trackers.account(profile)
	local xp = tonumber(profile.NewXP) or tonumber(profile.XP) or 0
	local level, progress
	if StaticInfo.LevelModule then
		level = Util.safe(function()
			return StaticInfo.LevelModule.GetLevel(xp)
		end)
		progress = Util.safe(function()
			return StaticInfo.LevelModule.GetProgressToNextLevel(xp)
		end)
	end
	return {
		Username = Util.safe(function() return LocalPlayer.Name end),
		DisplayName = Util.safe(function() return LocalPlayer.DisplayName end),
		UserId = Util.safe(function() return LocalPlayer.UserId end),
		Coins = tonumber(profile.CoinBag) or 0,
		XP = xp,
		Progress = progress,
		Level = level,
		Prestige = tonumber(profile.Prestige) or 0,
	}
end

function Trackers.presence()
	return {
		InRound = Presence.InRound,
		Map = Presence.Map,
		Role = Presence.Role,
	}
end

-- Generic per-category enrichment: profile.<Category>.Owned is {[itemKey]=qty},
-- profile.<Category>.Equipped (when present) is {[slot]=itemKey}. Looks each
-- owned key up in the matching static catalog for its display name/rarity/
-- image; falls back to the raw key if the catalog entry is missing.
function Trackers.category(owned, equippedMap, catalog)
	local out = {}
	if typeof(owned) ~= "table" then
		return out
	end

	local equippedKeys = {}
	if typeof(equippedMap) == "table" then
		for _, key in pairs(equippedMap) do
			if typeof(key) == "string" then
				equippedKeys[key] = true
			end
		end
	end

	for key, qty in pairs(owned) do
		local def = catalog and catalog[key]
		table.insert(out, {
			Key = key,
			Name = (def and (def.Name or def.ItemName)) or key,
			ItemType = def and def.ItemType,
			Rarity = def and def.Rarity,
			Image = def and def.Image,
			Quantity = tonumber(qty) or 0,
			Equipped = equippedKeys[key] == true,
			-- Only Materials catalog entries carry this; harmless elsewhere.
			Currency = (def and def.Currency) or nil,
		})
	end
	return out
end

--// ---------------------------------------------------------------------------
--// Snapshot assembly
--// ---------------------------------------------------------------------------
local Tracker = {}
Tracker.Snapshot = {}

function Tracker.build()
	local profile = Trackers.profile()
	if not profile then
		return { SchemaVersion = 1, CapturedAt = Util.safe(function() return os.time() end), Ready = false }
	end

	return {
		SchemaVersion = 1,
		CapturedAt = Util.safe(function() return os.time() end),
		Ready = true,
		Account = Trackers.account(profile),
		Presence = Trackers.presence(),
		Weapons = Trackers.category(
			profile.Weapons and profile.Weapons.Owned,
			profile.Weapons and profile.Weapons.Equipped,
			StaticInfo.Weapons
		),
		Pets = Trackers.category(
			profile.Pets and profile.Pets.Owned,
			profile.Pets and profile.Pets.Equipped,
			StaticInfo.Pets
		),
		Effects = Trackers.category(
			profile.Effects and profile.Effects.Owned,
			profile.Effects and profile.Effects.Equipped,
			StaticInfo.Effects
		),
		Toys = Trackers.category(
			profile.Toys and profile.Toys.Owned,
			profile.Toys and profile.Toys.Equipped,
			StaticInfo.Toys
		),
		-- Emotes carry no Equipped map (there's no "equipped emote" slot).
		Emotes = Trackers.category(profile.Emotes and profile.Emotes.Owned, nil, StaticInfo.Emotes),
		Radios = Trackers.category(
			profile.Radios and profile.Radios.Owned,
			profile.Radios and profile.Radios.Equipped,
			StaticInfo.Radios
		),
		-- No Equipped map — materials/currencies aren't equippable.
		Materials = Trackers.category(profile.Materials and profile.Materials.Owned, nil, StaticInfo.Materials),
	}
end

--// ---------------------------------------------------------------------------
--// Transport
--// ---------------------------------------------------------------------------
local Transport = {}

-- Return every executor HTTP function that actually exists, in preference
-- order. We used to stop at the first non-nil candidate and give up if that
-- one threw; some executors expose more than one of these and only some
-- actually work, so now every candidate gets tried before falling through.
local function resolveHttpRequestCandidates()
	local list = {}
	local function add(name, fn)
		if typeof(fn) == "function" then
			table.insert(list, { name = name, fn = fn })
		end
	end
	add("http_request", rawget(getfenv and getfenv() or _G, "http_request"))
	add("syn.request", syn and syn.request)
	add("http.request", http and http.request)
	add("request", rawget(_G, "request"))
	return list
end

function Transport.send(payload)
	local body = Util.safe(function()
		return HttpService:JSONEncode(payload)
	end)
	if not body then
		Log.warn("failed to JSON-encode payload")
		return false
	end

	if CONFIG.Endpoint == "" then
		Log.info("Endpoint not set; would send", #body, "bytes")
		return true
	end

	for _, candidate in ipairs(resolveHttpRequestCandidates()) do
		local ok, err = pcall(function()
			candidate.fn({
				Url = CONFIG.Endpoint,
				Method = "POST",
				Headers = { ["Content-Type"] = "application/json" },
				Body = body,
			})
		end)
		if ok then
			Log.info("sent", #body, "bytes via", candidate.name)
			return true
		end
		Log.warn(candidate.name .. " failed:", tostring(err))
	end

	local ok, err = pcall(function()
		HttpService:PostAsync(CONFIG.Endpoint, body, Enum.HttpContentType.ApplicationJson)
	end)
	if ok then
		Log.info("sent", #body, "bytes via HttpService")
		return true
	end
	Log.warn("HttpService:PostAsync failed:", tostring(err))

	Log.warn("all transport methods failed")
	return false
end

--// ---------------------------------------------------------------------------
--// Change engine: diff, debounce, flush
--// ---------------------------------------------------------------------------
local Engine = {}
Engine._lastCheck = 0
Engine._lastSend = 0

-- 'force' sends even when nothing changed — used for the periodic heartbeat
-- so last_seen keeps getting touched while you're online but idle.
function Engine.evaluate(force)
	local fresh = Tracker.build()
	if not force and Util.deepEqual(fresh, Tracker.Snapshot) then
		return
	end
	Tracker.Snapshot = Util.deepCopy(fresh)
	if Transport.send(fresh) then
		Engine._lastSend = os.clock()
	end
end

--// ---------------------------------------------------------------------------
--// Main loop
--// Unlike a push-replicated tracker, each check here is a real server round
--// trip (GetFullInventory), so the poll cadence is deliberately more
--// conservative than a purely local-read tracker would need.
--// ---------------------------------------------------------------------------
local function main()
	if not game:IsLoaded() then
		Log.info("waiting for the game to finish loading...")
		game.Loaded:Wait()
	end

	while not LocalPlayer do
		LocalPlayer = Players.LocalPlayer
		if not LocalPlayer then
			Log.info("waiting for LocalPlayer...")
			Players.PlayerAdded:Wait()
		end
	end

	Log.info("starting for", LocalPlayer.Name, "(" .. tostring(LocalPlayer.UserId) .. ")")

	StaticInfo.load()
	connectPresenceEvents()

	-- Prime the first snapshot immediately.
	Engine.evaluate()

	RunService.Heartbeat:Connect(function()
		local now = os.clock()
		if (now - Engine._lastCheck) >= CONFIG.FlushInterval then
			Engine._lastCheck = now
			local heartbeatDue = (now - Engine._lastSend) >= CONFIG.HeartbeatInterval
			Engine.evaluate(heartbeatDue)
		end
	end)

	Log.info("running (polling every " .. CONFIG.FlushInterval .. "s)")
end

task.spawn(main)

--// Expose the module surface for external drivers / debugging consoles.
return {
	CONFIG = CONFIG,
	Tracker = Tracker,
	Trackers = Trackers,
	StaticInfo = StaticInfo,
	Presence = Presence,
	Transport = Transport,
	Engine = Engine,
}
`;

export function buildTrackerScript(endpoint: string): string {
  return `-- Kirayu MM2 tracker v${TRACKER_VERSION}\n${TRACKER_TEMPLATE.replace("__INGEST_ENDPOINT__", endpoint)}`;
}
