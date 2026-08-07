/**
 * Embedded copy of ../../../../../gtd-updated-tracker/lobby_parker.lua.
 * Kept in sync manually. A minimal "parking" script - keeps an account
 * sitting in the GTD lobby and reports its live game.JobId to PocketBase
 * every 15s, so the trade subsystem on another account can teleport
 * straight to it instead of randomly hopping servers. Intentionally does
 * nothing else - run it only on dedicated trade-meeting-point accounts,
 * never alongside the farm (kaitun) script on the same account.
 */
const SCRIPT = String.raw`-- Kirayu Lobby Parker
-- Minimal "parking" script: keeps an account sitting in the GTD lobby (never
-- joins a match, no farming logic at all), stays anti-AFK so Roblox doesn't
-- idle-kick it, and reports its live game.JobId to PocketBase every 15s. The
-- Automation tab's Trade section reads that job id and sends another bot
-- straight to this exact server via TeleportToPlaceInstance, instead of that
-- bot randomly hopping public servers hoping to land on the same one.
--
-- Deploy to the SAME autoexec folder as summon_remote.lua / headless-kaitun.lua,
-- but only run it on accounts you want parked as trade meeting points - it
-- intentionally does nothing else, so don't run it alongside the farm script
-- on the same account.

local Players     = game:GetService("Players")
local HttpService = game:GetService("HttpService")

print("[Kirayu Lobby Parker] Bootstrap: waiting for game to load...")
if not game:IsLoaded() then
	game.Loaded:Wait()
end

local LocalPlayer = Players.LocalPlayer
while not LocalPlayer do
	Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
	LocalPlayer = Players.LocalPlayer
end
print("[Kirayu Lobby Parker] Ready as " .. LocalPlayer.Name .. " - job id " .. tostring(game.JobId))

-- ── Anti-AFK ──
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

-- ── PocketBase reporting (same collection/shape as headless-kaitun.lua's
-- syncTracker, but stripped down to just the fields a parked account needs) ──
local TRACKER_URL = "https://kirayutracker.online"
local TRACKER_JSON_HEADERS = { ["Content-Type"] = "application/json" }
local trackerRequestFunc = request
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

local REPORT_INTERVAL = 15 -- seconds

local function reportParked()
	local body = {
		username = LocalPlayer.Name,
		status = "online",
		lobby = "Lobby",
		action = "Parked (trade meeting point)",
		parked_job_id = game.JobId,
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

	if res and res.StatusCode == 404 then
		trackerRecordId = nil
	end
end

print("[Kirayu Lobby Parker] Reporting job id every " .. REPORT_INTERVAL .. "s.")

task.spawn(function()
	while true do
		pcall(reportParked)
		task.wait(REPORT_INTERVAL)
	end
end)
`;

export function buildLobbyParkerScript(): string {
  return SCRIPT;
}
