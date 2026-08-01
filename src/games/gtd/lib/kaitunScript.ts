/**
 * Embedded copy of ../../../../../roblox-executor-mcp-main/GardenTD_Headless_Linux.lua.
 * Kept in sync manually. The full headless farm bot: bootstrap, tracker sync,
 * AutoJoin/hostLobby, difficulty-vote + restart watcher, Macro playback,
 * PerfMode, and the gtd_summon_config-driven auto-trade subsystem (pauses
 * the farm via FarmPaused while an account is trading).
 */
const SCRIPT = String.raw`local CONFIG = {
	Map = "Volcanic Vengeance",
	Difficulty = "Hell",
	Speed = "Highest Available",

	AutoJoin = true,
	AutoEquip = true,

	Macro = "Volcano",
	MacroAutoPlay = true,
	MacroMode = "time",

	PerformanceMode = true,

	Tracker = true,
}

local Players           = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace         = game:GetService("Workspace")
local HttpService       = game:GetService("HttpService")
local GuiService        = game:GetService("GuiService")
local Lighting          = game:GetService("Lighting")

print("[Kirayu Headless] Bootstrap: waiting for game to load...")
if not game:IsLoaded() then
	game.Loaded:Wait()
end

print("[Kirayu Headless] Bootstrap: waiting for LocalPlayer...")
local LocalPlayer = Players.LocalPlayer
while not LocalPlayer do
	Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
	LocalPlayer = Players.LocalPlayer
end
print("[Kirayu Headless] Bootstrap: LocalPlayer ready (" .. LocalPlayer.Name .. ")")

local VirtualUser = game:GetService("VirtualUser")

local function resetIdleTimer()
	pcall(function()
		VirtualUser:CaptureController()
		VirtualUser:ClickButton2(Vector2.new())
	end)
end

LocalPlayer.Idled:Connect(resetIdleTimer)

task.spawn(function()
	while true do
		task.wait(180)
		resetIdleTimer()
	end
end)

print("[Kirayu Headless] Bootstrap: waiting for RemoteFunctions...")
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")

local function waitForChain(root, timeout, ...)
	local node = root
	for _, name in ipairs({ ... }) do
		if not node then
			return nil
		end
		node = node:WaitForChild(name, timeout)
	end
	return node
end

local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")
local MapIdChanged = Workspace:GetAttributeChangedSignal("MapId")

local LOBBY_MAP_ID = "map_lobby"

local function isInActiveMatch()
	local mapId = Workspace:GetAttribute("MapId")
	return mapId ~= nil and mapId ~= LOBBY_MAP_ID
end

local currentActionText = ""

-- Set by ApplyTradeConfig() when a per-account auto_trade flag flips on;
-- checked at AutoJoin/macro-trigger decision points so trading pauses the
-- farm without any loop having to poll it.
local FarmPaused = false
local GTD_PLACE_ID = 108533757090220 -- Garden Tower Defense (confirmed via summon_remote.lua)

print("[Kirayu Headless] Bootstrap: waiting for LogicHolder/ClientLoader/Modules (up to 45s)...")
local ModulesFolder = waitForChain(PlayerGui, 15, "LogicHolder", "ClientLoader", "Modules")
print("[Kirayu Headless] Bootstrap: Modules folder " .. (ModulesFolder and "found" or "NOT FOUND"))

print("[Kirayu Headless] Bootstrap: waiting for unit remotes...")
local RF_PlaceUnit           = RemoteFunctions:WaitForChild("PlaceUnit")
local RF_UpgradeUnit         = RemoteFunctions:WaitForChild("UpgradeUnit")
local RF_SellUnit            = RemoteFunctions:WaitForChild("SellUnit")
local RF_ChangeTickSpeed     = RemoteFunctions:WaitForChild("ChangeTickSpeed")
local RF_ActivateUnitAbility = RemoteFunctions:WaitForChild("ActivateUnitAbility")
local RF_RestartGame = RemoteFunctions:FindFirstChild("RestartGame")

print("[Kirayu Headless] Booting - Map=" .. tostring(CONFIG.Map) .. " Difficulty=" .. tostring(CONFIG.Difficulty)
	.. " Macro=" .. tostring(CONFIG.Macro))

local SAVE_ROOT = "kirayu/GardenTowerDefense"

local function ensureFolderPath(path)
	local built = nil
	for segment in path:gmatch("[^/]+") do
		built = built and (built .. "/" .. segment) or segment
		pcall(function()
			if not isfolder(built) then
				makefolder(built)
			end
		end)
	end
end

ensureFolderPath(SAVE_ROOT)

local DIFFICULTIES_HIGH_TO_LOW = {
	"dif_hell",
	"dif_apocalypse",
	"dif_impossible",
	"dif_insane",
	"dif_hard",
	"dif_normal",
	"dif_easy",
}

local DIFFICULTY_LABELS = {
	dif_hell       = "Hell",
	dif_apocalypse = "Apocalypse",
	dif_impossible = "Impossible",
	dif_insane     = "Insane",
	dif_hard       = "Hard",
	dif_normal     = "Normal",
	dif_easy       = "Easy",
}

local HIGHEST_LABEL = "Highest Available"
local DIFFICULTY_LABEL_TO_ID = {}
local DIFFICULTY_ID_SET = {}
for _, id in ipairs(DIFFICULTIES_HIGH_TO_LOW) do
	DIFFICULTY_LABEL_TO_ID[DIFFICULTY_LABELS[id]] = id
	DIFFICULTY_ID_SET[id] = true
end

local ALWAYS_HOST = true

local LAST_DIFFICULTY_FILE = SAVE_ROOT .. "/LastDifficulty.txt"

local function rememberChosenDifficulty(difficulty)
	if difficulty then
		pcall(function()
			writefile(LAST_DIFFICULTY_FILE, difficulty)
		end)
	end
end

local function getRememberedDifficulty()
	local ok, data = pcall(function()
		if isfile(LAST_DIFFICULTY_FILE) then
			return readfile(LAST_DIFFICULTY_FILE)
		end
		return nil
	end)
	if ok and type(data) == "string" and data ~= "" then
		return data
	end
	return nil
end

local function safeRequire(moduleScript)
	local ok, result = pcall(require, moduleScript)
	if ok then
		return result
	end
	return nil
end

local SharedItemData = ModulesFolder and safeRequire(ModulesFolder:FindFirstChild("SharedItemData")) or nil

local function buildMapList()
	local list = {}
	if SharedItemData then
		for _, v in pairs(SharedItemData.GetCategory("Maps")) do
			local p = v.Params
			if not (p.IsLobby or p.IsDungeon or p.IsPVP or p.NoSandbox or p.IsAdminArena) then
				list[p.Name] = v.ID
			end
		end
	end
	return list
end

local MapList = buildMapList()

local function resolveMapId(name)
	local mapId = MapList[name]
	if not mapId then
		MapList = buildMapList()
		mapId = MapList[name]
	end
	return mapId
end

local State = {
	SelectedMap = CONFIG.Map,
	SelectedDifficulty = (CONFIG.Difficulty ~= HIGHEST_LABEL) and DIFFICULTY_LABEL_TO_ID[CONFIG.Difficulty] or nil,
	PreferredSpeed = CONFIG.Speed,
}

if not MapList[State.SelectedMap] then
	warn("[Kirayu Headless] CONFIG.Map '" .. tostring(State.SelectedMap) .. "' doesn't match any live map name.")
end
if CONFIG.Difficulty ~= HIGHEST_LABEL and not State.SelectedDifficulty then
	warn("[Kirayu Headless] CONFIG.Difficulty '" .. tostring(CONFIG.Difficulty) .. "' isn't recognized - falling back to Highest Available.")
end

local function buildDifficultyOrder()
	local startIdx = State.SelectedDifficulty
		and table.find(DIFFICULTIES_HIGH_TO_LOW, State.SelectedDifficulty) or 1
	local order = {}
	for i = startIdx, #DIFFICULTIES_HIGH_TO_LOW do
		order[#order + 1] = DIFFICULTIES_HIGH_TO_LOW[i]
	end
	return order
end

local AUTO_EQUIP_UNIT_IDS = { "unit_rafflesia", "unit_trident" }
local AUTO_EQUIP_UNIT_SET = { unit_rafflesia = true, unit_trident = true }

local ClientDataHandler = ModulesFolder and safeRequire(ModulesFolder:FindFirstChild("ClientDataHandler"))
local RF_SetUnitEquipped = RemoteFunctions:FindFirstChild("SetUnitEquipped")

local function findInventoryKeyForUnit(unitId)
	if not ClientDataHandler then
		return nil
	end
	local ok, inventory = pcall(ClientDataHandler.GetValue, "Inventory")
	if not (ok and type(inventory) == "table") then
		return nil
	end
	for key, item in pairs(inventory) do
		if type(item) == "table" and item.ItemData and item.ItemData.ID == unitId then
			return key, item.Equipped == true
		end
	end
	return nil
end

local function findUnequippableSlot()
	if not ClientDataHandler then
		return nil
	end
	local ok, inventory = pcall(ClientDataHandler.GetValue, "Inventory")
	if not (ok and type(inventory) == "table") then
		return nil
	end
	for key, item in pairs(inventory) do
		if type(item) == "table" and item.Equipped and item.ItemData and not AUTO_EQUIP_UNIT_SET[item.ItemData.ID] then
			return key
		end
	end
	return nil
end

local function ensureAutoEquipUnits()
	if not (ClientDataHandler and RF_SetUnitEquipped) then
		return
	end
	pcall(ClientDataHandler.WaitForDataToLoad)

	for _, unitId in ipairs(AUTO_EQUIP_UNIT_IDS) do
		local key, equipped = findInventoryKeyForUnit(unitId)
		if key and not equipped then
			for _ = 1, 5 do
				pcall(RF_SetUnitEquipped.InvokeServer, RF_SetUnitEquipped, key, true, {})
				local start = tick()
				local confirmed = false
				while tick() - start < 2 do
					local _, nowEquipped = findInventoryKeyForUnit(unitId)
					if nowEquipped then
						confirmed = true
						break
					end
					task.wait(0.2)
				end
				if confirmed then
					break
				end

				local freeSlot = findUnequippableSlot()
				if freeSlot then
					pcall(RF_SetUnitEquipped.InvokeServer, RF_SetUnitEquipped, freeSlot, false, {})
					task.wait(0.3)
				else
					break
				end
			end
		end
	end
end

local TRACKER_URL = "https://kirayu-server.krayonstore-gtd.store"
local TRACKER_FORCE_INTERVAL = 120
local TRACKER_FALLBACK_INTERVAL = 15

local trackerRequestFunc = request
	or http_request
	or (syn and syn.request)
	or (fluxus and fluxus.request)
	or (krnl and krnl.request)
	or (electron and electron.request)
	or (oxygen and oxygen.request)

local TrackerNameCache = {}
local TrackerImageCache = {}

local function trackerExtractImage(data)
	for _, f in ipairs({ "Old__Image", "Image", "Thumbnail", "Icon", "ImageId", "AssetId", "Img" }) do
		local v = data[f]
		if v then
			local s = tostring(v)
			if s:find("^rbxassetid://") then
				return s
			end
			if tonumber(s) then
				return "rbxassetid://" .. s
			end
		end
	end
end

local function trackerScrapeFolder(folder)
	if not folder then
		return
	end
	local list = folder:GetChildren()
	for i, m in ipairs(list) do
		if m:IsA("ModuleScript") then
			local ok, d = pcall(require, m)
			if ok and type(d) == "table" then
				if d.Name then
					TrackerNameCache[m.Name] = d.Name
				end
				local img = trackerExtractImage(d)
				if img then
					TrackerImageCache[m.Name] = img
				end
			end
		end
		if i % 5 == 0 then
			task.wait()
		end
	end
end

if CONFIG.Tracker then
	task.spawn(function()
		local ClientLoader = ModulesFolder and ModulesFolder.Parent
		local ItemDataFolder = ClientLoader and ClientLoader:FindFirstChild("SharedConfig")
		ItemDataFolder = ItemDataFolder and ItemDataFolder:FindFirstChild("ItemData")
		if not ItemDataFolder then
			return
		end
		local UnitsFolder = ItemDataFolder:FindFirstChild("Units")
		if UnitsFolder then
			trackerScrapeFolder(UnitsFolder:FindFirstChild("Configs"))
		end
		local descendants = ItemDataFolder:GetDescendants()
		for i, obj in ipairs(descendants) do
			if obj:IsA("ModuleScript") and obj.Name:find("^dp_") then
				local ok2, d = pcall(require, obj)
				if ok2 and type(d) == "table" then
					if d.Name then
						TrackerNameCache[obj.Name] = d.Name
					end
					local img = trackerExtractImage(d)
					if img then
						TrackerImageCache[obj.Name] = img
					end
				end
			end
			if i % 25 == 0 then
				task.wait()
			end
		end
	end)
end

local TRACKER_JSON_HEADERS = { ["Content-Type"] = "application/json" }
local trackerRecordId = nil

local function trackerGet(path)
	if not trackerRequestFunc then
		return nil
	end
	local res = trackerRequestFunc({ Url = TRACKER_URL .. path, Method = "GET", Headers = TRACKER_JSON_HEADERS })
	if res and res.StatusCode == 200 then
		local ok, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
		if ok then
			return data
		end
	end
	return nil
end

local function trackerPost(path, body)
	if not trackerRequestFunc then
		return nil
	end
	return trackerRequestFunc({ Url = TRACKER_URL .. path, Method = "POST", Headers = TRACKER_JSON_HEADERS, Body = HttpService:JSONEncode(body) })
end

local function trackerPatch(path, body)
	if not trackerRequestFunc then
		return nil
	end
	return trackerRequestFunc({ Url = TRACKER_URL .. path, Method = "PATCH", Headers = TRACKER_JSON_HEADERS, Body = HttpService:JSONEncode(body) })
end

local function trackerEnsureRecord(username)
	if trackerRecordId then
		return trackerRecordId
	end
	local filter = HttpService:UrlEncode("(username='" .. username .. "')")
	local data = trackerGet("/api/collections/gtd_accounts/records?filter=" .. filter)
	if data and data.items and data.items[1] then
		trackerRecordId = data.items[1].id
	end
	return trackerRecordId
end

local trackerLastPayloadKey = ""
local trackerLastForcedSync = 0

local function getTrackerMapDisplay()
	local mapId = Workspace:GetAttribute("MapId")
	if not mapId or mapId == LOBBY_MAP_ID then
		return "lobby"
	end
	if SharedItemData then
		local ok, item = pcall(SharedItemData.GetItem, mapId)
		if ok and item and item.Params and item.Params.Name then
			return item.Params.Name
		end
	end
	return mapId:gsub("^map_", ""):gsub("_", " "):gsub("(%a)([%a]*)", function(a, b)
		return a:upper() .. b:lower()
	end)
end

local function syncTracker()
	if not (CONFIG.Tracker and trackerRequestFunc and ClientDataHandler) then
		return
	end

	pcall(ClientDataHandler.WaitForDataToLoad)
	local ok1, inventory = pcall(ClientDataHandler.GetValue, "Inventory")
	if not (ok1 and type(inventory) == "table") then
		return
	end
	local _, seedsRaw = pcall(ClientDataHandler.GetValue, "Seeds")
	local _, luckyRaw = pcall(ClientDataHandler.GetValue, "LuckyBlocks")
	local _, gpRaw = pcall(ClientDataHandler.GetValue, "GamePasses")

	local itemDict = {}
	local itemOrder = {}
	for _, e in pairs(inventory) do
		if type(e) == "table" and type(e.ItemData) == "table" then
			local id = e.ItemData.ID
			local amt = tonumber(e.Amount) or 0
			if type(id) == "string" and amt > 0 then
				if not itemDict[id] then
					itemDict[id] = {
						id = id,
						name = TrackerNameCache[id] or id,
						image = TrackerImageCache[id] or "",
						count = 0,
					}
					table.insert(itemOrder, id)
				end
				itemDict[id].count = itemDict[id].count + amt
			end
		end
	end

	local units = {}
	local allItems = {}
	for _, id in ipairs(itemOrder) do
		local item = itemDict[id]
		table.insert(allItems, item)
		if id:find("^unit_") and id ~= "unit_more" then
			table.insert(units, item)
		end
	end

	local seeds = math.floor(tonumber(seedsRaw) or 0)
	local luckyBlocks = math.floor(tonumber(luckyRaw) or 0)

	local x2Seeds, x3Speed = false, false
	local gp = type(gpRaw) == "table" and gpRaw or {}
	for k, v in pairs(gp) do
		if v then
			local kl = tostring(k):lower()
			if kl:find("double_seed") or kl:find("2x") or kl:find("doubleseed") or kl:find("x2seed") or kl:find("seedmultip") then
				x2Seeds = true
			end
			if kl:find("gamespeed_3") or kl:find("speed_3") or kl:find("3x") or kl:find("triplespeed") or kl:find("x3speed") or kl:find("speedmultip") then
				x3Speed = true
			end
		end
	end

	local stateStr = getTrackerMapDisplay()

	local invKey = ""
	for _, item in ipairs(units) do
		invKey = invKey .. item.id .. "=" .. item.count .. ";"
	end
	local payloadKey = stateStr .. "|" .. seeds .. "|" .. luckyBlocks .. "|" .. invKey .. "|" .. currentActionText

	local now = os.time()
	local forceSync = (now - trackerLastForcedSync) >= TRACKER_FORCE_INTERVAL
	if payloadKey == trackerLastPayloadKey and not forceSync then
		return
	end
	if forceSync then
		trackerLastForcedSync = now
	end

	local body = {
		username = LocalPlayer.Name,
		seeds = seeds,
		lucky_blocks = luckyBlocks,
		units = #units,
		lobby = stateStr,
		status = "online",
		action = currentActionText,
		x2_seeds = x2Seeds,
		x3_speed = x3Speed,
		inventory = allItems,
	}

	local rid = trackerEnsureRecord(LocalPlayer.Name)
	local res
	if rid then
		res = trackerPatch("/api/collections/gtd_accounts/records/" .. rid, body)
	else
		local createRes = trackerPost("/api/collections/gtd_accounts/records", body)
		if createRes and createRes.StatusCode == 200 then
			local ok2, created = pcall(HttpService.JSONDecode, HttpService, createRes.Body)
			if ok2 and created and created.id then
				trackerRecordId = created.id
			end
		end
		res = createRes
	end

	if res and res.StatusCode and res.StatusCode >= 200 and res.StatusCode < 300 then
		trackerLastPayloadKey = payloadKey
	elseif res and res.StatusCode == 404 then
		trackerRecordId = nil
	end
end

if CONFIG.Tracker then
	task.spawn(function()
		pcall(syncTracker)
		while true do
			task.wait(TRACKER_FALLBACK_INTERVAL)
			pcall(syncTracker)
		end
	end)
end

local function isAllowedMap(lobby, mapId)
	if lobby:GetAttribute("Mode") ~= nil then
		return false
	end
	local allowed = lobby:GetAttribute("AllowedMaps")
	if not allowed then
		return true
	end
	for id in string.gmatch(allowed, "[^;]+") do
		if id == mapId then
			return true
		end
	end
	return false
end

local function getEntryPart(lobby)
	local cage = lobby:FindFirstChild("Cage")
	if cage then
		local part = cage:FindFirstChildWhichIsA("BasePart")
		if part then
			return part
		end
	end
	return lobby:FindFirstChild("Detector") or lobby.PrimaryPart
end

local function getHumanoidRootPart(timeout)
	local start = tick()
	while tick() - start < (timeout or 5) do
		local character = LocalPlayer.Character
		local hrp = character and character:FindFirstChild("HumanoidRootPart")
		if hrp then
			return hrp
		end
		task.wait(0.2)
	end
	return nil
end

local function teleportInto(lobby)
	local hrp = getHumanoidRootPart(5)
	local part = lobby and lobby.Parent and getEntryPart(lobby)
	if not (hrp and part) then
		return false
	end
	hrp.CFrame = part.CFrame + Vector3.new(0, 3, 0)
	return true
end

local function waitForLobbyId(timeout)
	local start = tick()
	while tick() - start < (timeout or 5) do
		local id = LocalPlayer:GetAttribute("LobbyId")
		if id then
			return id
		end
		task.wait(0.25)
	end
	return nil
end

local function getGameLobbiesByTag()
	return CollectionService:GetTagged("GameLobby")
end

local function getGameLobbiesByHierarchy()
	local lobbies = {}
	local mapFolder = Workspace:FindFirstChild("Map")
	if mapFolder then
		for _, d in ipairs(mapFolder:GetDescendants()) do
			if d:IsA("Model") and d.Name == "GameLobby" then
				table.insert(lobbies, d)
			end
		end
	end
	return lobbies
end

local function getGameLobbies()
	local lobbies = getGameLobbiesByTag()
	if #lobbies == 0 then
		lobbies = getGameLobbiesByHierarchy()
	end
	return lobbies
end

local function findJoinableLobby(mapId)
	for _, lobby in ipairs(getGameLobbies()) do
		if lobby:GetAttribute("MapId") == mapId
			and lobby:GetAttribute("Mode") == nil
			and not lobby:GetAttribute("IsPvP")
			and (lobby:GetAttribute("Players") or 0) < (lobby:GetAttribute("MaxPlayers") or 0) then
			return lobby
		end
	end
	return nil
end

local function findEmptySpotForMap(mapId)
	for _, lobby in ipairs(getGameLobbies()) do
		if lobby.Parent
			and not lobby:GetAttribute("MapId")
			and not lobby:GetAttribute("IsPvP")
			and not lobby:GetAttribute("IsTeleporter")
			and lobby:GetAttribute("CanPickMap")
			and isAllowedMap(lobby, mapId)
			and (lobby:GetAttribute("Players") or 0) < (lobby:GetAttribute("MaxPlayers") or 1) then
			return lobby
		end
	end
	return nil
end

local function invokeAndConfirm(remoteName, args, confirmFn, attempts)
	attempts = attempts or 3
	for _ = 1, attempts do
		local remote = RemoteFunctions:FindFirstChild(remoteName)
		if remote then
			pcall(remote.InvokeServer, remote, table.unpack(args))
			local start = tick()
			while tick() - start < 3 do
				local ok, confirmed = pcall(confirmFn)
				if ok and confirmed then
					return true
				end
				task.wait(0.2)
			end
		else
			task.wait(0.5)
		end
	end
	local ok, confirmed = pcall(confirmFn)
	return ok and confirmed or false
end

local function setLobbyDifficulty(spot, lobbyId, mapId)
	local remote = RemoteFunctions:FindFirstChild("LobbySetMap_" .. lobbyId)
	if not remote then
		return nil
	end

	for _, difficulty in ipairs(buildDifficultyOrder()) do
		if not spot.Parent then
			return nil
		end
		local before = spot:GetAttribute("ChosenDifficulty")
		pcall(remote.InvokeServer, remote, mapId, difficulty, false)

		local start = tick()
		while tick() - start < 1.0 do
			if not spot.Parent then
				return nil
			end
			if spot:GetAttribute("MapId") == mapId then
				local applied = spot:GetAttribute("ChosenDifficulty")
				if applied == difficulty then
					return applied
				end
				if applied and applied ~= before and DIFFICULTY_ID_SET[applied] then
					return applied
				end
			end
			task.wait(0.1)
		end
	end
	return nil
end

local function hostLobby(mapId, autoStart)
	local spot
	for _ = 1, 3 do
		spot = findEmptySpotForMap(mapId)
		if spot and teleportInto(spot) then
			break
		end
		spot = nil
		task.wait(0.5)
	end
	if not spot then
		return false
	end

	local lobbyId = waitForLobbyId(5)
	if not lobbyId then
		return false
	end

	local chosen = setLobbyDifficulty(spot, lobbyId, mapId)
	if not chosen then
		return false
	end

	rememberChosenDifficulty(chosen)

	local playersConfirmed = invokeAndConfirm(
		"LobbySetMaxPlayers_" .. lobbyId,
		{ 1 },
		function()
			return spot.Parent and spot:GetAttribute("MaxPlayers") == 1
		end
	)
	if not playersConfirmed then
		return false, chosen
	end

	if autoStart then
		invokeAndConfirm("StartLobby_" .. lobbyId, {}, function()
			return true
		end, 1)
	end

	return true, chosen
end

local function getCurrentLocation()
	local mapId = Workspace:GetAttribute("MapId")
	if not mapId or mapId == LOBBY_MAP_ID then
		return "Lobby", nil
	end
	local name = mapId
	if SharedItemData then
		local ok2, item = pcall(SharedItemData.GetItem, mapId)
		if ok2 and item and item.Params and item.Params.Name then
			name = item.Params.Name
		end
	end
	return "Map: " .. name, mapId
end

local GUIModule = waitForChain(PlayerGui, 10, "LogicHolder", "ClientLoader", "Plugins", "UserInterface", "GUI")
local GUI = GUIModule and safeRequire(GUIModule)

local function closeUnitViewer()
	if not GUI then
		return
	end
	pcall(GUI.CloseMenu, "UnitViewer")
end

local function clickGui(button)
	if not button then
		return
	end
	pcall(firesignal, button.Activated)
	pcall(firesignal, button.MouseButton1Click)
	pcall(firesignal, button.MouseButton1Down)
	pcall(firesignal, button.MouseButton1Up)
	local ok, VirtualInputManager = pcall(game.GetService, game, "VirtualInputManager")
	if ok and VirtualInputManager then
		pcall(function()
			local center = button.AbsolutePosition + button.AbsoluteSize / 2
			VirtualInputManager:SendMouseButtonEvent(center.X, center.Y, 0, true, game, 1)
			VirtualInputManager:SendMouseButtonEvent(center.X, center.Y, 0, false, game, 1)
		end)
	end
end

local SPEED_VALUES = { ["x1"] = 1, ["x2"] = 2, ["x3"] = 3 }

local cachedWaveControls, cachedWaveControlsMapId = nil, nil

local function getWaveControls()
	local mapId = Workspace:GetAttribute("MapId")
	if cachedWaveControls and cachedWaveControlsMapId == mapId and cachedWaveControls.Parent then
		return cachedWaveControls
	end
	local waveControls = PlayerGui:FindFirstChild("GameGuiNoInset")
	waveControls = waveControls and waveControls:FindFirstChild("Screen")
	waveControls = waveControls and waveControls:FindFirstChild("Top")
	waveControls = waveControls and waveControls:FindFirstChild("WaveControls")
	cachedWaveControls = waveControls
	cachedWaveControlsMapId = mapId
	return waveControls
end

local function applyAutoSkipAndMaxSpeed()
	local waveControls = getWaveControls()
	if waveControls then
		local autoSkip = waveControls:FindFirstChild("AutoSkip")
		local autoSkipTitle = autoSkip and autoSkip:FindFirstChild("Title")
		if autoSkipTitle and autoSkipTitle.Text ~= "Auto Skip: On" then
			clickGui(autoSkip)
		end
	end

	local exact = SPEED_VALUES[State.PreferredSpeed]
	if exact then
		if Workspace:GetAttribute("TickSpeed") ~= exact then
			pcall(RF_ChangeTickSpeed.InvokeServer, RF_ChangeTickSpeed, exact)
		end
		return
	end

	if Workspace:GetAttribute("TickSpeed") == 3 then
		return
	end

	pcall(RF_ChangeTickSpeed.InvokeServer, RF_ChangeTickSpeed, 3)
	local start = tick()
	while tick() - start < 1 and Workspace:GetAttribute("TickSpeed") ~= 3 do
		task.wait(0.1)
	end
	local speed = Workspace:GetAttribute("TickSpeed")
	if speed ~= 3 and speed ~= 2 then
		pcall(RF_ChangeTickSpeed.InvokeServer, RF_ChangeTickSpeed, 2)
	end
end

task.spawn(function()
	while true do
		if isInActiveMatch() then
			pcall(applyAutoSkipAndMaxSpeed)
		end
		task.wait(6)
	end
end)

local PERF_LIGHTING_EFFECT_NAMES = { "Bloom", "SunRays", "ColorCorrection" }

local PerfMode = {
	enabled = false,
	entitiesConn = nil,
	savedGlobalShadows = nil,
	hudManuallyHidden = false,
}

local function setModelHidden(root, hidden)
	local modifier = hidden and 1 or 0
	for _, d in ipairs(root:GetDescendants()) do
		if d:IsA("BasePart") then
			d.LocalTransparencyModifier = modifier
		elseif d:IsA("ParticleEmitter") or d:IsA("Trail") or d:IsA("Beam") then
			d.Enabled = not hidden
		end
	end
end

local function setEntitiesHidden(entitiesFolder, hidden)
	for _, model in ipairs(entitiesFolder:GetChildren()) do
		if model:IsA("Model") then
			pcall(setModelHidden, model, hidden)
		end
	end
end

local function refreshPerformanceStripping()
	if not (PerfMode.enabled and isInActiveMatch()) then
		return
	end

	local map = Workspace:FindFirstChild("Map")
	local entitiesFolder = map and map:FindFirstChild("Entities")
	local decorFolder = map and map:FindFirstChild("Model")

	if decorFolder then
		pcall(setModelHidden, decorFolder, true)
	end

	if PerfMode.entitiesConn then
		PerfMode.entitiesConn:Disconnect()
		PerfMode.entitiesConn = nil
	end
	if entitiesFolder then
		setEntitiesHidden(entitiesFolder, true)
		PerfMode.entitiesConn = entitiesFolder.ChildAdded:Connect(function(child)
			if PerfMode.enabled and child:IsA("Model") then
				pcall(setModelHidden, child, true)
			end
		end)
	end
end

local function restorePerformanceStripping()
	local map = Workspace:FindFirstChild("Map")
	local entitiesFolder = map and map:FindFirstChild("Entities")
	local decorFolder = map and map:FindFirstChild("Model")
	if decorFolder then
		pcall(setModelHidden, decorFolder, false)
	end
	if entitiesFolder then
		setEntitiesHidden(entitiesFolder, false)
	end
end

local DIM_TRANSPARENCY = 0
local DIM_DISPLAY_ORDER = 150
local HUD_DISPLAY_ORDER = 200
local EYE_DISPLAY_ORDER = 210

local DimGui, DimFrame
local function ensureDimGui()
	if DimGui then
		return
	end
	DimGui = Instance.new("ScreenGui")
	DimGui.Name = "PerfModeDim"
	DimGui.ResetOnSpawn = false
	DimGui.IgnoreGuiInset = true
	DimGui.DisplayOrder = DIM_DISPLAY_ORDER

	DimFrame = Instance.new("Frame")
	DimFrame.Name = "Dim"
	DimFrame.Size = UDim2.fromScale(1, 1)
	DimFrame.BackgroundColor3 = Color3.new(0, 0, 0)
	DimFrame.BackgroundTransparency = DIM_TRANSPARENCY
	DimFrame.BorderSizePixel = 0
	DimFrame.Active = false
	DimFrame.Visible = false
	DimFrame.Parent = DimGui

	DimGui.Parent = PlayerGui
end

local RunStats = {
	startClock = nil,
	startSeeds = nil,
}

local function formatNumber(n)
	n = math.floor(n or 0)
	local sign = n < 0 and "-" or ""
	local digits = tostring(math.abs(n)):reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", "")
	return sign .. digits
end

local function formatDuration(totalSeconds)
	totalSeconds = math.floor(totalSeconds)
	local hours = math.floor(totalSeconds / 3600)
	local minutes = math.floor((totalSeconds % 3600) / 60)
	local seconds = totalSeconds % 60
	if hours > 0 then
		return string.format("%d:%02d:%02d", hours, minutes, seconds)
	end
	return string.format("%d:%02d", minutes, seconds)
end

task.spawn(function()
	while not isInActiveMatch() do
		task.wait(1)
	end
	RunStats.startClock = os.clock()
	local seeds = 0
	if ClientDataHandler then
		local ok, v = pcall(ClientDataHandler.GetValue, "Seeds")
		if ok and type(v) == "number" then
			seeds = v
		end
	end
	RunStats.startSeeds = seeds
end)

local HUD_SEEDS_ICON = "rbxassetid://81971356726927"
local HUD_TEXT_COLOR = Color3.new(1, 1, 1)
local HUD_STROKE_COLOR = Color3.new(0, 0, 0)
local HUD_GAINED_COLOR = Color3.fromRGB(150, 255, 150)

local function applyHudTextStyle(label, size, color)
	label.Font = Enum.Font.Cartoon
	label.TextSize = size
	label.TextColor3 = color
	label.TextXAlignment = Enum.TextXAlignment.Left
	local stroke = Instance.new("UIStroke")
	stroke.Color = HUD_STROKE_COLOR
	stroke.Thickness = 3
	stroke.Parent = label
end

local function newIconLabel(name, image, size, parent)
	local icon = Instance.new("ImageLabel")
	icon.Name = name
	icon.BackgroundTransparency = 1
	icon.Size = UDim2.fromOffset(size, size)
	icon.Image = image
	icon.Parent = parent
	local ratio = Instance.new("UIAspectRatioConstraint")
	ratio.AspectRatio = 1
	ratio.Parent = icon
	return icon
end

local HudGui, HudPanel, HudNameText, HudMapText, HudRuntimeText, HudSeedsText, HudGainedText, HudLogText
local function ensureHud()
	if HudGui then
		return
	end
	HudGui = Instance.new("ScreenGui")
	HudGui.Name = "KirayuHub"
	HudGui.ResetOnSpawn = false
	HudGui.IgnoreGuiInset = true
	HudGui.DisplayOrder = HUD_DISPLAY_ORDER

	HudPanel = Instance.new("Frame")
	HudPanel.Name = "Panel"
	HudPanel.BackgroundTransparency = 1
	local topInset = select(1, GuiService:GetGuiInset()).Y
	HudPanel.AnchorPoint = Vector2.new(0.5, 0.5)
	HudPanel.Position = UDim2.new(0.5, 0, 0.42, topInset)
	HudPanel.Size = UDim2.fromOffset(0, 0)
	HudPanel.AutomaticSize = Enum.AutomaticSize.XY
	HudPanel.Visible = false
	HudPanel.Parent = HudGui

	local mainLayout = Instance.new("UIListLayout")
	mainLayout.Padding = UDim.new(0, 10)
	mainLayout.SortOrder = Enum.SortOrder.LayoutOrder
	mainLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	mainLayout.Parent = HudPanel

	HudNameText = Instance.new("TextLabel")
	HudNameText.Name = "PlayerName"
	HudNameText.BackgroundTransparency = 1
	HudNameText.Size = UDim2.fromOffset(0, 26)
	HudNameText.AutomaticSize = Enum.AutomaticSize.X
	HudNameText.LayoutOrder = 0
	HudNameText.Parent = HudPanel
	applyHudTextStyle(HudNameText, 22, HUD_TEXT_COLOR)
	HudNameText.TextXAlignment = Enum.TextXAlignment.Center

	HudMapText = Instance.new("TextLabel")
	HudMapText.Name = "Map"
	HudMapText.BackgroundTransparency = 1
	HudMapText.Size = UDim2.fromOffset(0, 26)
	HudMapText.AutomaticSize = Enum.AutomaticSize.X
	HudMapText.LayoutOrder = 1
	HudMapText.Parent = HudPanel
	applyHudTextStyle(HudMapText, 22, HUD_TEXT_COLOR)
	HudMapText.TextXAlignment = Enum.TextXAlignment.Center

	local seedsRow = Instance.new("Frame")
	seedsRow.Name = "SeedsRow"
	seedsRow.BackgroundTransparency = 1
	seedsRow.Size = UDim2.fromOffset(0, 0)
	seedsRow.AutomaticSize = Enum.AutomaticSize.XY
	seedsRow.LayoutOrder = 2
	seedsRow.Parent = HudPanel
	local seedsRowLayout = Instance.new("UIListLayout")
	seedsRowLayout.FillDirection = Enum.FillDirection.Horizontal
	seedsRowLayout.VerticalAlignment = Enum.VerticalAlignment.Center
	seedsRowLayout.Padding = UDim.new(0, 6)
	seedsRowLayout.SortOrder = Enum.SortOrder.LayoutOrder
	seedsRowLayout.Parent = seedsRow
	local seedsIcon = newIconLabel("Icon", HUD_SEEDS_ICON, 50, seedsRow)
	seedsIcon.LayoutOrder = 0
	HudSeedsText = Instance.new("TextLabel")
	HudSeedsText.Name = "Text"
	HudSeedsText.BackgroundTransparency = 1
	HudSeedsText.Size = UDim2.fromOffset(0, 50)
	HudSeedsText.AutomaticSize = Enum.AutomaticSize.X
	HudSeedsText.LayoutOrder = 1
	HudSeedsText.Parent = seedsRow
	applyHudTextStyle(HudSeedsText, 36, HUD_TEXT_COLOR)

	HudGainedText = Instance.new("TextLabel")
	HudGainedText.Name = "Gained"
	HudGainedText.BackgroundTransparency = 1
	HudGainedText.Size = UDim2.fromOffset(0, 50)
	HudGainedText.AutomaticSize = Enum.AutomaticSize.X
	HudGainedText.LayoutOrder = 2
	HudGainedText.Parent = seedsRow
	applyHudTextStyle(HudGainedText, 36, HUD_GAINED_COLOR)

	HudRuntimeText = Instance.new("TextLabel")
	HudRuntimeText.Name = "Runtime"
	HudRuntimeText.BackgroundTransparency = 1
	HudRuntimeText.Size = UDim2.fromOffset(0, 26)
	HudRuntimeText.AutomaticSize = Enum.AutomaticSize.X
	HudRuntimeText.LayoutOrder = 3
	HudRuntimeText.Parent = HudPanel
	applyHudTextStyle(HudRuntimeText, 22, HUD_TEXT_COLOR)
	HudRuntimeText.TextXAlignment = Enum.TextXAlignment.Center

	HudLogText = Instance.new("TextLabel")
	HudLogText.Name = "Status"
	HudLogText.BackgroundTransparency = 1
	HudLogText.Size = UDim2.fromOffset(0, 0)
	HudLogText.AutomaticSize = Enum.AutomaticSize.XY
	HudLogText.LayoutOrder = 4
	HudLogText.TextWrapped = false
	HudLogText.Parent = HudPanel
	applyHudTextStyle(HudLogText, 16, Color3.fromRGB(190, 190, 190))
	HudLogText.TextXAlignment = Enum.TextXAlignment.Center

	HudGui.Parent = PlayerGui
end

local hudStatusBase = ""
local hudStatusAnimated = false

local function pushHudLog(msg)
	local base, hits = msg:gsub("%.%.%.$", "")
	hudStatusBase = base
	hudStatusAnimated = hits > 0
	currentActionText = base
	if HudLogText then
		HudLogText.Text = hudStatusAnimated and (hudStatusBase .. "...") or hudStatusBase
	end
	pcall(syncTracker)
end

task.spawn(function()
	local dotCount = 3
	while true do
		task.wait(0.4)
		if hudStatusAnimated and HudLogText then
			dotCount = (dotCount % 3) + 1
			HudLogText.Text = hudStatusBase .. string.rep(".", dotCount)
		end
	end
end)

local EyeGui, EyeButton
local refreshPerfVisibility

local function ensureEyeButton()
	if EyeGui then
		return
	end
	EyeGui = Instance.new("ScreenGui")
	EyeGui.Name = "KirayuHubEyeToggle"
	EyeGui.ResetOnSpawn = false
	EyeGui.IgnoreGuiInset = true
	EyeGui.DisplayOrder = EYE_DISPLAY_ORDER
	EyeGui.Enabled = false

	local topInset = select(1, GuiService:GetGuiInset()).Y

	EyeButton = Instance.new("TextButton")
	EyeButton.Name = "EyeToggle"
	EyeButton.AnchorPoint = Vector2.new(1, 0)
	EyeButton.Position = UDim2.new(1, -14, 0, topInset + 14)
	EyeButton.Size = UDim2.fromOffset(38, 38)
	EyeButton.BackgroundColor3 = Color3.new(0, 0, 0)
	EyeButton.BackgroundTransparency = 0.4
	EyeButton.AutoButtonColor = false
	EyeButton.Font = Enum.Font.SourceSansBold
	EyeButton.TextSize = 20
	EyeButton.TextColor3 = Color3.new(1, 1, 1)
	EyeButton.Text = "\240\159\145\129"
	EyeButton.Parent = EyeGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(1, 0)
	corner.Parent = EyeButton

	EyeButton.Activated:Connect(function()
		PerfMode.hudManuallyHidden = not PerfMode.hudManuallyHidden
		refreshPerfVisibility()
	end)

	EyeGui.Parent = PlayerGui
end

refreshPerfVisibility = function()
	local shouldShow = PerfMode.enabled and isInActiveMatch() and not PerfMode.hudManuallyHidden
	if DimFrame then
		DimFrame.Visible = shouldShow
	end
	if HudPanel then
		HudPanel.Visible = shouldShow
	end
	if EyeButton then
		EyeButton.Text = PerfMode.hudManuallyHidden and "\240\159\153\136" or "\240\159\145\129"
	end
end

local function refreshHud()
	if not (HudPanel and HudPanel.Visible) then
		return
	end

	local seeds = 0
	if ClientDataHandler then
		local ok, v = pcall(ClientDataHandler.GetValue, "Seeds")
		if ok and type(v) == "number" then
			seeds = v
		end
	end

	HudNameText.Text = LocalPlayer.Name
	HudMapText.Text = getCurrentLocation()
	HudSeedsText.Text = formatNumber(seeds)
	HudRuntimeText.Text = RunStats.startClock and formatDuration(os.clock() - RunStats.startClock) or "--"

	if RunStats.startSeeds then
		local delta = seeds - RunStats.startSeeds
		HudGainedText.Text = "(" .. (delta >= 0 and "+" or "") .. formatNumber(delta) .. ")"
	else
		HudGainedText.Text = "(+0)"
	end
end

task.spawn(function()
	while true do
		pcall(refreshHud)
		task.wait(2)
	end
end)

local function applyPerformanceEffects()
	if not (PerfMode.enabled and isInActiveMatch()) then
		return
	end
	refreshPerformanceStripping()
	for _, name in ipairs(PERF_LIGHTING_EFFECT_NAMES) do
		local fx = Lighting:FindFirstChild(name)
		if fx then
			fx.Enabled = false
		end
	end
	if PerfMode.savedGlobalShadows == nil then
		PerfMode.savedGlobalShadows = Lighting.GlobalShadows
	end
	Lighting.GlobalShadows = false
	ensureDimGui()
	ensureHud()
	ensureEyeButton()
	EyeGui.Enabled = true
	refreshPerfVisibility()
	refreshHud()
end

local function onMapExited()
	restorePerformanceStripping()
	for _, name in ipairs(PERF_LIGHTING_EFFECT_NAMES) do
		local fx = Lighting:FindFirstChild(name)
		if fx then
			fx.Enabled = true
		end
	end
	if PerfMode.savedGlobalShadows ~= nil then
		Lighting.GlobalShadows = PerfMode.savedGlobalShadows
	end
	if DimFrame then
		DimFrame.Visible = false
	end
	if HudPanel then
		HudPanel.Visible = false
	end
	if EyeGui then
		EyeGui.Enabled = false
	end
end

local function setPerformanceMode(on)
	PerfMode.enabled = on
	if on then
		applyPerformanceEffects()
	else
		if PerfMode.entitiesConn then
			PerfMode.entitiesConn:Disconnect()
			PerfMode.entitiesConn = nil
		end
		onMapExited()
	end
end

task.spawn(function()
	while true do
		MapIdChanged:Wait()
		local ok, err = pcall(function()
			if isInActiveMatch() then
				if PerfMode.enabled then
					task.wait(0.5)
					applyPerformanceEffects()
				end
			else
				if PerfMode.entitiesConn then
					PerfMode.entitiesConn:Disconnect()
					PerfMode.entitiesConn = nil
				end
				onMapExited()
			end
		end)
		if not ok then
			warn("[Kirayu Headless] Performance mode watcher error (recovered): " .. tostring(err))
		end
	end
end)

if CONFIG.PerformanceMode then
	setPerformanceMode(true)
end

task.spawn(function()
	while true do
		pcall(function()
			local gui = PlayerGui:FindFirstChild("CutsceneSkip")
			local btn = gui and gui:FindFirstChild("Cancel")
			if btn then
				task.wait(0.5)
				if btn.Parent then
					clickGui(btn)
				end
			end
		end)
		task.wait(1)
	end
end)

local function pickDifficultyVoteButton(itemsFrame)
	if not State.SelectedDifficulty then
		local remembered = getRememberedDifficulty()
		if remembered then
			local btn = itemsFrame:FindFirstChild(remembered)
			if btn and not btn.IsLocked.Visible then
				return btn
			end
		end
	end
	for _, id in ipairs(buildDifficultyOrder()) do
		local btn = itemsFrame:FindFirstChild(id)
		if btn and not btn.IsLocked.Visible then
			return btn
		end
	end
	return nil
end

local function voteDifficulty(itemsFrame)
	local remote = RemoteFunctions:FindFirstChild("PlaceDifficultyVote")
	if remote then
		local order = {}
		local seen = {}
		if not State.SelectedDifficulty then
			local remembered = getRememberedDifficulty()
			if remembered then
				table.insert(order, remembered)
				seen[remembered] = true
			end
		end
		for _, id in ipairs(buildDifficultyOrder()) do
			if not seen[id] then
				table.insert(order, id)
			end
		end

		for _, difficulty in ipairs(order) do
			local ok, result = pcall(remote.InvokeServer, remote, difficulty)
			if ok and result ~= false then
				return true
			end
		end
		return false
	end

	local btn = pickDifficultyVoteButton(itemsFrame)
	if btn then
		clickGui(btn)
		return true
	end
	return false
end

local onMatchRestarted = nil

local function probeDifficultyVote()
	local dv = PlayerGui.GameGui.Screen.Middle.DifficultyVote
	return dv.Visible, dv.Items.Frame.Items.Items
end

local function probeGameEnd()
	local gameEnd = PlayerGui.GameGui.Screen.Middle.GameEnd
	local frame = gameEnd.Items.Frame
	local outcome = "Match"
	if frame.Defeat.Visible then
		outcome = "Defeat"
	elseif frame.Victory.Visible then
		outcome = "Victory"
	elseif frame.Tie.Visible then
		outcome = "Tie"
	end
	return gameEnd.Visible, frame.Actions.Items.Again, outcome
end

task.spawn(function()
	local RETRY_INTERVAL = 2
	local RESTART_SETTLE_DELAY = 2.5
	local lastDifficultyPickAttempt = 0
	local lastRestartAttempt = 0
	local wasOutcomeVisible = false
	local outcomeVisibleSince = nil
	local hasLoggedRestarting = false
	local lastStuckWarn = 0
	while true do
		task.wait(1)

		local ok, err = pcall(function()
			closeUnitViewer()
			local okDv, dvVisible, itemsFrame = pcall(probeDifficultyVote)
			if okDv and dvVisible then
				if tick() - lastDifficultyPickAttempt > RETRY_INTERVAL then
					voteDifficulty(itemsFrame)
					lastDifficultyPickAttempt = tick()
				end
			else
				lastDifficultyPickAttempt = 0
			end

			local okGe, outcomeVisible, again, outcomeType = pcall(probeGameEnd)
			outcomeVisible = okGe and outcomeVisible or false

			if outcomeVisible then
				if not outcomeVisibleSince then
					outcomeVisibleSince = tick()
					hasLoggedRestarting = false
					pushHudLog((outcomeType or "Match") .. " - waiting for UI...")
				end

				local settled = tick() - outcomeVisibleSince >= RESTART_SETTLE_DELAY
				if settled then
					if not hasLoggedRestarting then
						pushHudLog("Restarting...")
						hasLoggedRestarting = true
					end
					if tick() - lastRestartAttempt > RETRY_INTERVAL then
						if RF_RestartGame then
							pcall(RF_RestartGame.InvokeServer, RF_RestartGame)
						end
						clickGui(again)
						lastRestartAttempt = tick()
					end
				end

				if tick() - outcomeVisibleSince > 20 and tick() - lastStuckWarn > 20 then
					warn("[Kirayu Headless] Outcome screen has stayed visible for " .. math.floor(tick() - outcomeVisibleSince) .. "s despite repeated 'Again' clicks - the click likely isn't registering on this executor.")
					pushHudLog("Stuck on outcome screen (" .. math.floor(tick() - outcomeVisibleSince) .. "s)")
					lastStuckWarn = tick()
				end
			else
				lastRestartAttempt = 0
				outcomeVisibleSince = nil
				hasLoggedRestarting = false
				if wasOutcomeVisible and onMatchRestarted then
					onMatchRestarted()
				end
			end
			wasOutcomeVisible = outcomeVisible
		end)
		if not ok then
			warn("[Kirayu Headless] Restart loop error (recovered): " .. tostring(err))
		end
	end
end)

local Macro = {
	events = {},
	playing = false,
	autoLoop = false,
	mode = CONFIG.MacroMode == "money" and "money" or "time",
}

local function shallowCopy(t)
	local out = {}
	for k, v in pairs(t) do
		out[k] = v
	end
	return out
end

local ACTION_RETRY_TIMEOUT = 60

local function attemptAction(remote, getArgs)
	local start = tick()
	local ok, success, resultId
	repeat
		local args = getArgs()
		ok, success, resultId = pcall(remote.InvokeServer, remote, table.unpack(args))
		if ok and success then
			return ok, success, resultId
		end
		task.wait(0.3)
	until not Macro.playing or tick() - start > ACTION_RETRY_TIMEOUT
	return ok, success, resultId
end

local JITTER_MIN_STUDS = 2
local JITTER_MAX_STUDS = 6

local function jitterPlacementArgs(args)
	local payload = args[2]
	if not (type(payload) == "table" and typeof(payload.CF) == "CFrame") then
		return args
	end
	local angle = math.random() * math.pi * 2
	local magnitude = JITTER_MIN_STUDS + math.random() * (JITTER_MAX_STUDS - JITTER_MIN_STUDS)
	local offset = Vector3.new(math.cos(angle) * magnitude, 0, math.sin(angle) * magnitude)

	local jitteredPayload = shallowCopy(payload)
	jitteredPayload.CF = payload.CF + offset

	local jitteredArgs = shallowCopy(args)
	jitteredArgs[2] = jitteredPayload
	return jitteredArgs
end

local function playMacro()
	if Macro.playing or #Macro.events == 0 then
		return
	end
	Macro.playing = true
	pushHudLog("Playing macro (" .. #Macro.events .. " actions)...")
	task.spawn(function()
		local ok, err = pcall(function()
		local lastT = 0
		local idRemap = {}
		for _, ev in ipairs(Macro.events) do
			if not Macro.playing then
				break
			end

			local remote = (ev.action == "Place" and RF_PlaceUnit)
				or (ev.action == "Upgrade" and RF_UpgradeUnit)
				or (ev.action == "Ability" and RF_ActivateUnitAbility)
				or RF_SellUnit

			local getArgs
			if ev.action == "Place" then
				getArgs = function()
					return jitterPlacementArgs(ev.args)
				end
			else
				local args = ev.args
				if args[1] ~= nil and idRemap[args[1]] ~= nil then
					args = shallowCopy(args)
					args[1] = idRemap[args[1]]
				end
				getArgs = function()
					return args
				end
			end

			if Macro.mode ~= "money" then
				local delay = ev.t - lastT
				if delay > 0 then
					task.wait(delay)
				end
			end

			local actionOk, success, resultId = attemptAction(remote, getArgs)
			lastT = ev.t

			if actionOk and ev.action == "Place" and success and ev.placedId ~= nil then
				idRemap[ev.placedId] = resultId
			end
		end
		end)
		closeUnitViewer()
		if not ok then
			warn("[Kirayu Headless] Macro playback error (recovered): " .. tostring(err))
			pushHudLog("Macro error (recovered)")
		else
			pushHudLog("Macro finished")
		end
		Macro.playing = false
	end)
end

local function decodePayload(payload)
	local info = {}
	for k, v in pairs(payload) do
		if k == "CF" and type(v) == "table" then
			info[k] = CFrame.new(table.unpack(v))
		elseif type(v) == "table" and #v == 3 then
			info[k] = Vector3.new(v[1], v[2], v[3])
		else
			info[k] = v
		end
	end
	return info
end

local function loadMacroFromJSON(jsonText)
	local ok, data = pcall(function()
		return HttpService:JSONDecode(jsonText)
	end)
	if not (ok and type(data) == "table" and type(data.actions) == "table") then
		return false, "Corrupt or unrecognized macro data"
	end

	local loaded = {}
	for _, a in ipairs(data.actions) do
		if a.type == "place" then
			table.insert(loaded, {
				t = a.gameTime or 0,
				action = "Place",
				args = { a.unitName, decodePayload(a.payload or {}) },
				placedId = tonumber(a.placedId),
				wave = a.wave,
			})
		elseif a.type == "upgrade" and a.placedId then
			table.insert(loaded, {
				t = a.gameTime or 0,
				action = "Upgrade",
				args = { tonumber(a.placedId) },
				wave = a.wave,
			})
		elseif a.type == "delete" and a.placedId then
			table.insert(loaded, {
				t = a.gameTime or 0,
				action = "Delete",
				args = { tonumber(a.placedId) },
				wave = a.wave,
			})
		elseif a.type == "ability" and a.placedId then
			table.insert(loaded, {
				t = a.gameTime or 0,
				action = "Ability",
				args = { tonumber(a.placedId) },
				wave = a.wave,
			})
		end
	end
	Macro.events = loaded
	return true
end

local EMBEDDED_MACRO_JSON = [==[
{
  "game": "GardenTowerDefense",
  "version": 1,
  "actions": [
    {
      "type": "place",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 7.230645000003278,
      "wave": 1,
      "cost": 500,
      "costSource": "data",
      "payload": {
        "CF": [110.62696838378906, -31.568737030029297, -62.36854553222656, -1, 0, -8.742277657347586e-08, 0, 1, 0, 8.742277657347586e-08, 0, -1],
        "Position": [110.62696838378906, -31.568737030029297, -62.36854553222656],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 13.647176500002388,
      "wave": 1,
      "cost": 500,
      "costSource": "data",
      "payload": {
        "CF": [119.08146667480469, -31.568737030029297, -64.24916076660156, -1, 0, -8.742277657347586e-08, 0, 1, 0, 8.742277657347586e-08, 0, -1],
        "Position": [119.08146667480469, -31.568737030029297, -64.24916076660156],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 16.148198099981528,
      "wave": 2,
      "cost": 500,
      "costSource": "data",
      "payload": {
        "CF": [115.77204895019531, -31.56873893737793, -77.71859741210938, -1, 0, -8.742277657347586e-08, 0, 1, 0, 8.742277657347586e-08, 0, -1],
        "Position": [115.77204895019531, -31.56873893737793, -77.71859741210938],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "58",
      "upgradeIndex": 1,
      "gameTime": 20.613399200025015,
      "wave": 2,
      "cost": 700,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "58",
      "upgradeIndex": 2,
      "gameTime": 21.313283500028774,
      "wave": 2,
      "cost": 1050,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "58",
      "upgradeIndex": 3,
      "gameTime": 26.846659899980295,
      "wave": 3,
      "cost": 1275,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "58",
      "upgradeIndex": 4,
      "gameTime": 29.446876499976497,
      "wave": 3,
      "cost": 1500,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "52",
      "upgradeIndex": 1,
      "gameTime": 34.98048339999514,
      "wave": 4,
      "cost": 700,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "52",
      "upgradeIndex": 2,
      "gameTime": 36.84653799998341,
      "wave": 4,
      "cost": 1050,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "52",
      "upgradeIndex": 3,
      "gameTime": 38.279782700003125,
      "wave": 4,
      "cost": 1275,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "52",
      "upgradeIndex": 4,
      "gameTime": 40.22911200003,
      "wave": 5,
      "cost": 1500,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "59",
      "upgradeIndex": 1,
      "gameTime": 43.0952827000292,
      "wave": 5,
      "cost": 700,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "59",
      "upgradeIndex": 2,
      "gameTime": 44.896426299994346,
      "wave": 5,
      "cost": 1050,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "59",
      "upgradeIndex": 3,
      "gameTime": 45.54534030001378,
      "wave": 5,
      "cost": 1275,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_trident",
      "placedId": "59",
      "upgradeIndex": 4,
      "gameTime": 45.99550850002561,
      "wave": 5,
      "cost": 1500,
      "costSource": "data"
    },
    {
      "type": "place",
      "unitName": "unit_rafflesia",
      "placedId": "140",
      "gameTime": 49.829061300028116,
      "wave": 6,
      "cost": 1250,
      "costSource": "data",
      "payload": {
        "CF": [107.6832275390625, -31.318737030029297, -70.25082397460938, -0, 0, 1, 0, 1, -0, -1, 0, -0],
        "DistanceAlongPath": 21.078201293945312,
        "PathIndex": 1,
        "Position": [107.6832275390625, -31.318737030029297, -70.25082397460938],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_rafflesia",
      "placedId": "156",
      "gameTime": 55.71197890001349,
      "wave": 7,
      "cost": 1250,
      "costSource": "data",
      "payload": {
        "CF": [102.21720886230469, -31.31800079345703, -66.70500183105469, -0.7071068286895752, 0, 0.7071067690849304, 0, 1, -0, -0.7071068286895752, 0, -0.7071067690849304],
        "DistanceAlongPath": 14.32182196938949,
        "PathIndex": 1,
        "Position": [102.21720886230469, -31.31800079345703, -66.70500183105469],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_rafflesia",
      "placedId": "183",
      "gameTime": 63.727831800002605,
      "wave": 8,
      "cost": 1250,
      "costSource": "data",
      "payload": {
        "CF": [100.97584533691406, -31.31800079345703, -65.46363830566406, -0.7071068286895752, 0, 0.7071067690849304, 0, 1, -0, -0.7071068286895752, 0, -0.7071067690849304],
        "DistanceAlongPath": 12.566263517785233,
        "PathIndex": 1,
        "Position": [100.97584533691406, -31.31800079345703, -65.46363830566406],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_rafflesia",
      "placedId": "216",
      "gameTime": 71.54515750001883,
      "wave": 8,
      "cost": 1250,
      "costSource": "data",
      "payload": {
        "CF": [99.86353302001953, -31.318737030029297, -59.548789978027344, -1, 0, -0, -0, 1, -0, -0, 0, -1],
        "DistanceAlongPath": 6.369041442871094,
        "PathIndex": 1,
        "Position": [99.86353302001953, -31.318737030029297, -59.548789978027344],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_rafflesia",
      "placedId": "248",
      "gameTime": 79.37959040002897,
      "wave": 9,
      "cost": 1250,
      "costSource": "data",
      "payload": {
        "CF": [99.86353302001953, -31.318737030029297, -58.78730010986328, -1, 0, -0, -0, 1, -0, -0, 0, -1],
        "DistanceAlongPath": 5.607551574707031,
        "PathIndex": 1,
        "Position": [99.86353302001953, -31.318737030029297, -58.78730010986328],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "place",
      "unitName": "unit_rafflesia",
      "placedId": "254",
      "gameTime": 86.8613403000054,
      "wave": 10,
      "cost": 1250,
      "costSource": "data",
      "payload": {
        "CF": [99.86353302001953, -31.318737030029297, -58.53990173339844, -1, 0, -0, -0, 1, -0, -0, 0, -1],
        "DistanceAlongPath": 5.3601531982421875,
        "PathIndex": 1,
        "Position": [99.86353302001953, -31.318737030029297, -58.53990173339844],
        "Rotation": 180,
        "Valid": true
      }
    },
    {
      "type": "upgrade",
      "unitName": "unit_rafflesia",
      "placedId": "140",
      "upgradeIndex": 1,
      "gameTime": 102.14374770002905,
      "wave": 12,
      "cost": 8000,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_rafflesia",
      "placedId": "156",
      "upgradeIndex": 1,
      "gameTime": 106.44304340000963,
      "wave": 13,
      "cost": 8000,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_rafflesia",
      "placedId": "183",
      "upgradeIndex": 1,
      "gameTime": 108.01043399999617,
      "wave": 13,
      "cost": 8000,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_rafflesia",
      "placedId": "216",
      "upgradeIndex": 1,
      "gameTime": 108.8443694000016,
      "wave": 13,
      "cost": 8000,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_rafflesia",
      "placedId": "248",
      "upgradeIndex": 1,
      "gameTime": 109.62690969998948,
      "wave": 13,
      "cost": 8000,
      "costSource": "data"
    },
    {
      "type": "upgrade",
      "unitName": "unit_rafflesia",
      "placedId": "254",
      "upgradeIndex": 1,
      "gameTime": 110.32656660000794,
      "wave": 13,
      "cost": 8000,
      "costSource": "data"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 122.8422098000301,
      "wave": 15,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 123.24204590002773,
      "wave": 15,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 123.60899109998718,
      "wave": 15,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 133.37486899999203,
      "wave": 16,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 133.89273770002183,
      "wave": 16,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 134.27513640001416,
      "wave": 16,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 143.97531609999714,
      "wave": 17,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 144.54125559999375,
      "wave": 17,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 145.34235589997843,
      "wave": 18,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 154.37523679999867,
      "wave": 19,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 155.05815980001353,
      "wave": 19,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 155.7423285000259,
      "wave": 19,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 164.8078147000051,
      "wave": 20,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 165.5244349000277,
      "wave": 20,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 166.15843690000474,
      "wave": 20,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 175.3903575000004,
      "wave": 21,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 176.12351730000228,
      "wave": 21,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 176.7236042000004,
      "wave": 21,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "52",
      "gameTime": 186.0405058999895,
      "wave": 23,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "58",
      "gameTime": 186.6731424999889,
      "wave": 23,
      "costSource": "unknown"
    },
    {
      "type": "ability",
      "unitName": "unit_trident",
      "placedId": "59",
      "gameTime": 187.30643070000224,
      "wave": 23,
      "costSource": "unknown"
    }
  ]
}
]==]

if CONFIG.Macro then
	local ok, err = loadMacroFromJSON(EMBEDDED_MACRO_JSON)
	if ok then
		print("[Kirayu Headless] Loaded embedded macro '" .. CONFIG.Macro .. "' - " .. #Macro.events .. " events")
	else
		warn("[Kirayu Headless] " .. tostring(err))
	end
end
Macro.autoLoop = (CONFIG.Macro ~= nil) and CONFIG.MacroAutoPlay or false

onMatchRestarted = function()
	pushHudLog("Match restarted")
	if Macro.autoLoop and not FarmPaused then
		Macro.playing = false
		task.wait(2)
		playMacro()
	end
end

task.spawn(function()
	local wasInMap = false
	while true do
		local inMap = isInActiveMatch()
		if inMap and not wasInMap then
			pushHudLog("Round started")
		end
		wasInMap = inMap
		task.wait(1)
	end
end)

if CONFIG.Macro and CONFIG.MacroAutoPlay then
	task.spawn(function()
		while not isInActiveMatch() do
			task.wait(1)
		end
		if not FarmPaused then
			playMacro()
		end
	end)
end

-- ===== Auto-trade subsystem =====
-- Ported from headless-kaitun.lua. Reads gtd_summon_config (already live on
-- the tracker server) for a per-account auto_trade toggle + target + item
-- list; when on, pauses the farm (FarmPaused) and runs its own trade loop.
-- Everything here lives in its own task.spawn on a multi-second task.wait
-- cadence (5s config poll, 2s trade-loop tick) - nothing here ever runs
-- inside Macro/attemptAction's per-action loop, which is what caused the
-- previous "90% slower" regression when this was merged in before.

local TradeConfig = {
	AutoTrade = false,
	TargetPlayer = "",
	TargetJobId = "", -- when set, join this exact server instead of hopping randomly
	TradeItems = {}, -- { {unit_id = "unit_x", amount = 3}, ... }
}

-- Canonical string for a { {unit_id=, amount=}, ... } list, order-sensitive -
-- used only to cheaply detect whether the remote trade_items list changed.
local function TradeItemsSignature(items)
	local parts = {}
	for _, item in ipairs(items or {}) do
		table.insert(parts, tostring(item.unit_id) .. ":" .. tostring(item.amount))
	end
	return table.concat(parts, ",")
end

-- Fresh pre-round gate: checked right before AutoJoin's hostLobby() commits
-- to a round, so a just-flipped auto_trade can't be missed by the 5s poll.
local function isAutoTradeEnabledNow()
	local filter = HttpService:UrlEncode("(username='" .. LocalPlayer.Name .. "')")
	local data = trackerGet("/api/collections/gtd_summon_config/records?filter=" .. filter)
	if data and data.items and data.items[1] then
		return data.items[1].auto_trade == true
	end
	return false
end

local function FetchTradeConfig()
	local filter = HttpService:UrlEncode("(username='" .. LocalPlayer.Name .. "')")
	local data = trackerGet("/api/collections/gtd_summon_config/records?filter=" .. filter)
	if not data or not data.items or #data.items == 0 then
		return nil
	end
	return data.items[1]
end

-- Fallback: target has no known parked job id, so keep leaving/rejoining
-- until matchmaking happens to land both accounts together.
local function hopServer()
	print("[Kirayu Headless] Trade: target not seen for a while - hopping to another server.")
	pushHudLog("Hopping servers for " .. TradeConfig.TargetPlayer .. "...")
	local TeleportService = game:GetService("TeleportService")
	pcall(TeleportService.Teleport, TeleportService, GTD_PLACE_ID, LocalPlayer)
end

-- Preferred: target is parked in a known server (lobby_parker.lua reports its
-- job id into trade_target_job_id) - join that exact instance directly.
local function joinTargetServer()
	if TradeConfig.TargetJobId ~= "" then
		print("[Kirayu Headless] Trade: joining parked server " .. TradeConfig.TargetJobId .. " for " .. TradeConfig.TargetPlayer .. ".")
		pushHudLog("Joining " .. TradeConfig.TargetPlayer .. "'s server...")
		local TeleportService = game:GetService("TeleportService")
		local ok = pcall(TeleportService.TeleportToPlaceInstance, TeleportService, GTD_PLACE_ID, TradeConfig.TargetJobId, LocalPlayer)
		if ok then
			return
		end
		warn("[Kirayu Headless] Trade: direct join to parked server failed, falling back to random hop.")
	end
	hopServer()
end

-- The "Amount" field is a TextLabel, not typable - the only way to set
-- quantity is dragging the slider via VirtualInputManager.
local function setTradeAmount(picker, desiredAmount)
	local sliderBar = picker:FindFirstChild("SliderContainer")
	if not sliderBar then
		return false
	end
	local dragCircle = sliderBar:FindFirstChild("DragCircle")
	local maxValLabel = picker:FindFirstChild("AmountMax")

	local ready = false
	for _ = 1, 20 do
		if sliderBar.AbsoluteSize.X > 0 and dragCircle.AbsoluteSize.X > 0 then
			ready = true
			break
		end
		task.wait(0.05)
	end
	if not ready then
		return false
	end

	local maxVal = tonumber(maxValLabel and maxValLabel.Text) or desiredAmount
	local clamped = math.max(1, math.min(desiredAmount, maxVal))
	local inset = GuiService:GetGuiInset()

	local startX = dragCircle.AbsolutePosition.X + (dragCircle.AbsoluteSize.X / 2) + inset.X
	local startY = dragCircle.AbsolutePosition.Y + (dragCircle.AbsoluteSize.Y / 2) + inset.Y
	local fullEndX = sliderBar.AbsolutePosition.X + sliderBar.AbsoluteSize.X + inset.X - 10
	local targetX = startX + (fullEndX - startX) * (maxVal > 0 and (clamped / maxVal) or 1)

	local ok, VIM = pcall(game.GetService, game, "VirtualInputManager")
	if not ok then
		return false
	end

	VIM:SendMouseMoveEvent(startX, startY, game)
	task.wait(0.05)
	VIM:SendMouseButtonEvent(startX, startY, 0, true, game, 0)
	task.wait(0.05)
	for i = 1, 6 do
		VIM:SendMouseMoveEvent(startX + (targetX - startX) * (i / 6), startY, game)
		task.wait(0.02)
	end
	VIM:SendMouseButtonEvent(targetX, startY, 0, false, game, 0)
	return true, clamped
end

local RF_SendTradeInvite = RemoteFunctions:FindFirstChild("SendTradeInvite")
local lastTradeInviteSent = 0
local TradeLoopRunning = false
local targetMissingSince = nil
local TARGET_HOP_TIMEOUT = 15 -- seconds without seeing the target before hopping servers

local function runTradeLoop()
	if TradeLoopRunning then
		return
	end
	TradeLoopRunning = true

	task.spawn(function()
		while TradeConfig.AutoTrade do
			local ok, err = pcall(function()
				if not RF_SendTradeInvite or TradeConfig.TargetPlayer == "" then
					return
				end

				local target = nil
				for _, p in ipairs(Players:GetPlayers()) do
					if p ~= LocalPlayer and p.Name:lower() == TradeConfig.TargetPlayer:lower() then
						target = p
						break
					end
				end
				if not target then
					if not targetMissingSince then
						targetMissingSince = tick()
						pushHudLog("Waiting for " .. TradeConfig.TargetPlayer .. "...")
					elseif tick() - targetMissingSince > TARGET_HOP_TIMEOUT then
						joinTargetServer()
					end
					return
				end
				targetMissingSince = nil

				local tradeGui = PlayerGui:FindFirstChild("GameGui")
					and PlayerGui.GameGui.Screen.Middle:FindFirstChild("Trade")
				local termsUI = tradeGui and tradeGui:FindFirstChild("Terms")
				local moreBtn = tradeGui
					and tradeGui:FindFirstChild("Items", true)
					and tradeGui.Items.Container.Items.Left.Give.Items.ScrollingFrame:FindFirstChild("unit_more")

				if not (termsUI and termsUI.Visible) and not (moreBtn and moreBtn.Visible) then
					if tick() - lastTradeInviteSent > 8 then
						pcall(RF_SendTradeInvite.InvokeServer, RF_SendTradeInvite, target)
						lastTradeInviteSent = tick()
					end
				end

				if termsUI and termsUI.Visible then
					clickGui(termsUI.Items.Buttons.Items:FindFirstChild("Accept"))
					task.wait(0.5)
				end

				if moreBtn and moreBtn.Visible and #TradeConfig.TradeItems > 0 then
					local giveSf = tradeGui.Items.Container.Items.Left.Give.Items.ScrollingFrame

					for _, item in ipairs(TradeConfig.TradeItems) do
						if not moreBtn.Visible then break end
						if not giveSf:FindFirstChild(item.unit_id) then
							clickGui(moreBtn)
							task.wait(1.2)
							local child = tradeGui.Inventory.Inventory.Frame.Items.Items.ScrollingFrame:FindFirstChild(item.unit_id)
							local btn = child and child:FindFirstChild("TextButton")
							if btn then
								clickGui(btn)
								task.wait(0.3)
								if tradeGui.AmountAdd.Visible then
									local picker = tradeGui.AmountAdd.Frame.Frame.Items.Items.Picker
									local setOk, applied = setTradeAmount(picker, item.amount)
									if setOk then
										local reached = false
										for _ = 1, 20 do
											if tonumber(picker.Amount.Text) == applied then
												reached = true
												break
											end
											task.wait(0.05)
										end
										if reached then
											clickGui(tradeGui.AmountAdd.Frame.Frame.Actions.Items.Add)
										else
											warn("[Kirayu Headless] Trade: amount slider never reached " .. tostring(applied) .. " for " .. item.unit_id .. " - cancelling, will retry.")
											clickGui(tradeGui.AmountAdd.Frame.Frame.Actions.Items.Cancel)
										end
									else
										warn("[Kirayu Headless] Trade: AmountAdd layout never became ready for " .. item.unit_id .. " - cancelling, will retry.")
										clickGui(tradeGui.AmountAdd.Frame.Frame.Actions.Items.Cancel)
									end
									repeat
										task.wait(0.1)
									until not tradeGui.AmountAdd.Visible
								end
							end
						end
					end

					local allQueued = true
					for _, item in ipairs(TradeConfig.TradeItems) do
						if not giveSf:FindFirstChild(item.unit_id) then
							allQueued = false
							break
						end
					end

					if not allQueued then
						warn("[Kirayu Headless] Trade: not all queued items are in the Give list yet - holding off Accept, will retry.")
					else
						local finalBtn = tradeGui.Items.Container.Items.Right.Controls.Items.Buttons:FindFirstChild("Accept")
						if finalBtn then
							local label = finalBtn:FindFirstChildWhichIsA("TextLabel", true) or finalBtn
							local waitStart = tick()
							repeat
								task.wait(0.5)
							until label.Text == "Accept" or label.Text == "READY" or not moreBtn.Visible or tick() - waitStart > 30
							if moreBtn.Visible then
								clickGui(finalBtn)
								task.wait(4)
							end
						end
					end
				end
			end)
			if not ok then
				warn("[Kirayu Headless] Trade loop error (recovered): " .. tostring(err))
			end
			task.wait(2)
		end
		TradeLoopRunning = false
	end)
end

local function ApplyTradeConfig(remote)
	if not remote then
		return
	end

	local newAutoTrade = remote.auto_trade == true
	if newAutoTrade ~= TradeConfig.AutoTrade then
		TradeConfig.AutoTrade = newAutoTrade
		FarmPaused = newAutoTrade
		if newAutoTrade then
			print("[Kirayu Headless] Trading enabled - pausing farm.")
			pushHudLog("Trading - farm paused")
			runTradeLoop()
		else
			print("[Kirayu Headless] Trading disabled - resuming farm.")
			pushHudLog("Resuming farm")
		end
	end

	if remote.trade_target ~= nil then
		TradeConfig.TargetPlayer = remote.trade_target
	end
	if remote.trade_target_job_id ~= nil then
		TradeConfig.TargetJobId = remote.trade_target_job_id
	end
	if type(remote.trade_items) == "table" then
		local newSig = TradeItemsSignature(remote.trade_items)
		if newSig ~= TradeItemsSignature(TradeConfig.TradeItems) then
			TradeConfig.TradeItems = remote.trade_items
		end
	end
end

task.spawn(function()
	local ok, remote = pcall(FetchTradeConfig)
	if ok then
		pcall(ApplyTradeConfig, remote)
	end
	while true do
		task.wait(5)
		local ok2, remote2 = pcall(FetchTradeConfig)
		if ok2 then
			pcall(ApplyTradeConfig, remote2)
		end
	end
end)

if CONFIG.AutoJoin then
	task.spawn(function()
		local lastDiag = 0
		local hasLoggedSearching = false
		while true do
			local ok, err = pcall(function()
				if FarmPaused then
					return
				end
				if not isInActiveMatch() and not LocalPlayer:GetAttribute("LobbyId") then
					local mapId = resolveMapId(State.SelectedMap)
					if not mapId then
						if tick() - lastDiag > 10 then
							warn("[Kirayu Headless] AutoJoin: map '" .. tostring(State.SelectedMap) .. "' not found yet (map list still loading or name mismatch) - retrying.")
							lastDiag = tick()
						end
					else
						if not hasLoggedSearching then
							pushHudLog("Joining " .. State.SelectedMap .. "...")
							hasLoggedSearching = true
						end

						if CONFIG.AutoEquip then
							ensureAutoEquipUnits()
						end

						local lobby = (not ALWAYS_HOST) and findJoinableLobby(mapId) or nil
						if lobby and teleportInto(lobby) then
							if waitForLobbyId(4) then
								print("[Kirayu Headless] Joined a " .. State.SelectedMap .. " lobby")
								pushHudLog("Joined " .. State.SelectedMap)
								hasLoggedSearching = false
							end
						elseif isAutoTradeEnabledNow() then
							-- Fresh gate: catches an auto_trade flip that landed after the
							-- last 5s poll, right before this loop would otherwise commit
							-- to hosting a new round.
							local ok3, remote3 = pcall(FetchTradeConfig)
							if ok3 then
								pcall(ApplyTradeConfig, remote3)
							end
						else
							local created, chosen = hostLobby(mapId, true)
							if created then
								print("[Kirayu Headless] Created & started " .. State.SelectedMap .. " (" .. (DIFFICULTY_LABELS[chosen] or tostring(chosen)) .. ")")
								pushHudLog("Hosted " .. State.SelectedMap .. " (" .. (DIFFICULTY_LABELS[chosen] or tostring(chosen)) .. ")")
								hasLoggedSearching = false
							elseif tick() - lastDiag > 10 then
								warn("[Kirayu Headless] AutoJoin: no empty lobby spot for '" .. State.SelectedMap .. "' found/hostable yet - retrying.")
								lastDiag = tick()
							end
						end
					end
				end
			end)
			if not ok then
				warn("[Kirayu Headless] AutoJoin loop error (recovered): " .. tostring(err))
			end
			task.wait(3)
		end
	end)
end

print("[Kirayu Headless] Running.")
`;

export function buildKaitunScript(): string {
  return SCRIPT;
}
