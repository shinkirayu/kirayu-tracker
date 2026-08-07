/**
 * Embedded copy of ../../../../gtd-updated-tracker/reporter.lua. Kept in sync
 * manually — if the tracker changes, copy the new source in here too.
 *
 * Unlike AE/MM2, GTD's ingest has no per-user token: gtd_accounts is a
 * fully open collection (see kirayu-server/README.md's "Known gap: GTD is
 * not multi-tenant"), and this script already points at kirayu-server
 * directly — so there's nothing to fill in per user, just copy and run.
 */
const TRACKER_SCRIPT = String.raw`-- ⚙️ CONFIG
local PB_URL         = "https://kirayutracker.online"
local SEND_INTERVAL  = 30    -- seconds between syncs
local FORCE_INTERVAL = 300   -- force sync even if nothing changed

-- ── SERVICES ─────────────────────────────────────────────────────
local Players     = game:GetService("Players")
local RS          = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

-- ── HTTP FUNCTION ─────────────────────────────────────────────────
local requestFunc = request
    or http_request
    or (syn      and syn.request)
    or (fluxus   and fluxus.request)
    or (krnl     and krnl.request)
    or (electron and electron.request)
    or (oxygen   and oxygen.request)

-- ── HELPERS ──────────────────────────────────────────────────────
local function getISO8601()
    return os.date("!%Y-%m-%dT%H:%M:%S.000Z", os.time())
end

local LOBBY_MAP_ID = "map_lobby"

local function getMapDisplay(sharedItemData)
    local mapId = workspace:GetAttribute("MapId")
    if not mapId or mapId == LOBBY_MAP_ID then return "lobby" end
    if sharedItemData then
        local ok, item = pcall(sharedItemData.GetItem, mapId)
        if ok and item and item.Params and item.Params.Name then
            return item.Params.Name
        end
    end
    -- Fallback: map_volcanic_vengeance → "Volcanic Vengeance"
    return mapId:gsub("^map_", ""):gsub("_", " "):gsub("(%a)([%a]*)", function(a, b) return a:upper() .. b:lower() end)
end

-- ── MAIN ─────────────────────────────────────────────────────────
task.spawn(function()
    if not game:IsLoaded() then game.Loaded:Wait() end

    local LP = Players.LocalPlayer or Players:WaitForChild("LocalPlayer", 120)
    if not LP then return warn("[PB] No LocalPlayer") end

    local pGui = LP:WaitForChild("PlayerGui", 60)
    if not pGui then return warn("[PB] No PlayerGui") end

    pGui:WaitForChild("GameGui", 300)
    if not LP.Character then LP.CharacterAdded:Wait() end

    -- ── CONFIG SCRAPE (names + images, runs once at startup) ──────
    local IMAGE_FIELDS = { "Old__Image", "Image", "Thumbnail", "Icon", "ImageId", "AssetId", "Img" }
    local NameCache  = {}
    local ImageCache = {}

    local function extractImage(data)
        for _, f in ipairs(IMAGE_FIELDS) do
            local v = data[f]
            if v then
                local s = tostring(v)
                if s:find("^rbxassetid://") then return s end
                if tonumber(s) then return "rbxassetid://" .. s end
            end
        end
    end

    local function scrapeFolder(folder)
        if not folder then return end
        local list = folder:GetChildren()
        for i, m in ipairs(list) do
            if m:IsA("ModuleScript") then
                local ok, d = pcall(require, m)
                if ok and type(d) == "table" then
                    if d.Name then NameCache[m.Name] = d.Name end
                    local img = extractImage(d)
                    if img then ImageCache[m.Name] = img end
                end
            end
            if i % 25 == 0 then task.wait() end
        end
    end

    local ok, ItemData = pcall(function()
        return pGui
            :WaitForChild("LogicHolder", 30)
            :WaitForChild("ClientLoader", 30)
            :WaitForChild("SharedConfig", 30)
            :WaitForChild("ItemData", 30)
    end)

    if ok and ItemData then
        local UnitsFolder = ItemData:FindFirstChild("Units")
        if UnitsFolder then
            scrapeFolder(UnitsFolder:FindFirstChild("Configs"))
        end
        for _, obj in ipairs(ItemData:GetDescendants()) do
            if obj:IsA("ModuleScript") and obj.Name:find("^dp_") then
                local ok2, d = pcall(require, obj)
                if ok2 and type(d) == "table" then
                    if d.Name then NameCache[obj.Name] = d.Name end
                    local img = extractImage(d)
                    if img then ImageCache[obj.Name] = img end
                end
            end
        end
        print("[PB] Config scrape done.")
    else
        warn("[PB] ItemData not found - names/images will be IDs only")
    end

    -- Load SharedItemData for map name resolution
    local sharedItemData = nil
    pcall(function()
        local cl = pGui:WaitForChild("LogicHolder", 5):WaitForChild("ClientLoader", 5)
        sharedItemData = require(cl:WaitForChild("Modules", 5):WaitForChild("SharedItemData", 5))
    end)

    -- ── PB HELPERS ────────────────────────────────────────────────
    local JSON_HEADERS = { ["Content-Type"] = "application/json" }
    local pbRecordId = nil

    local function pbGet(path)
        local res = requestFunc({ Url = PB_URL .. path, Method = "GET", Headers = JSON_HEADERS })
        if res and res.StatusCode == 200 then
            local ok2, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
            if ok2 then return data end
        elseif res then
            warn("[PB GET] " .. tostring(res.StatusCode) .. " " .. tostring(res.Body):sub(1,120))
        end
        return nil
    end

    local function pbPost(path, body)
        local res = requestFunc({ Url = PB_URL .. path, Method = "POST", Headers = JSON_HEADERS, Body = HttpService:JSONEncode(body) })
        if res and res.StatusCode ~= 200 then
            warn("[PB POST] " .. tostring(res.StatusCode) .. " " .. tostring(res.Body):sub(1,120))
        end
        return res
    end

    local function pbPatch(path, body)
        local res = requestFunc({ Url = PB_URL .. path, Method = "PATCH", Headers = JSON_HEADERS, Body = HttpService:JSONEncode(body) })
        if res and res.StatusCode ~= 200 then
            warn("[PB PATCH] " .. tostring(res.StatusCode) .. " " .. tostring(res.Body):sub(1,120))
        end
        return res
    end

    local function ensureRecord(username)
        if pbRecordId then return pbRecordId end
        local filter = HttpService:UrlEncode("(username='" .. username .. "')")
        local data = pbGet("/api/collections/gtd_accounts/records?filter=" .. filter)
        if data and data.items and data.items[1] then
            pbRecordId = data.items[1].id
        end
        return pbRecordId
    end

    print("[PB] Ready:", LP.Name)

    -- ── DEDUP STATE ───────────────────────────────────────────────
    local lastPayloadKey = ""
    local lastForcedSync = 0

    -- ── READ UPVALUE ──────────────────────────────────────────────
    local function readPlayerData()
        if not (getconnections and getupvalues) then return nil end
        local re = RS:FindFirstChild("RemoteEvents")
        if not re then return nil end

        for _, evtName in ipairs({ "LoadPlayerData", "UpdatePlayerData", "UpdateUnitInventory" }) do
            local evt = re:FindFirstChild(evtName)
            if not evt then continue end
            for _, conn in ipairs(getconnections(evt.OnClientEvent)) do
                if not conn.Function then continue end
                local ok2, uvs = pcall(getupvalues, conn.Function)
                if not ok2 then continue end
                for _, uv in pairs(uvs) do
                    if type(uv) ~= "table" then continue end
                    local inv = rawget(uv, "Inventory")
                    if type(inv) ~= "table" then continue end
                    return {
                        Inventory   = inv,
                        Seeds       = rawget(uv, "Seeds"),
                        LuckyBlocks = rawget(uv, "LuckyBlocks"),
                        Boosts      = rawget(uv, "Boosts"),
                        GamePasses  = rawget(uv, "GamePasses"),
                    }
                end
            end
        end
        return nil
    end

    -- ── SEND DATA ─────────────────────────────────────────────────
    local function sendData()
        if not requestFunc then return end

        local data = readPlayerData()
        if not data then
            warn("[PB] Could not read player data upvalue")
            return
        end

        -- Build inventory (all items with names + images)
        local itemDict  = {}
        local itemOrder = {}
        for _, e in pairs(data.Inventory) do
            if type(e) == "table" and type(e.ItemData) == "table" then
                local id  = e.ItemData.ID
                local amt = tonumber(e.Amount) or 0
                if type(id) == "string" and amt > 0 then
                    if not itemDict[id] then
                        itemDict[id] = {
                            id    = id,
                            name  = NameCache[id]  or id,
                            image = ImageCache[id] or "",
                            count = 0,
                        }
                        table.insert(itemOrder, id)
                    end
                    itemDict[id].count = itemDict[id].count + amt
                end
            end
        end

        local units    = {}
        local allItems = {}
        for _, id in ipairs(itemOrder) do
            local item = itemDict[id]
            table.insert(allItems, item)
            if id:find("^unit_") and id ~= "unit_more" then
                table.insert(units, item)
            end
        end

        local seeds       = math.floor(tonumber(data.Seeds)       or 0)
        local luckyBlocks = math.floor(tonumber(data.LuckyBlocks) or 0)

        local x2Seeds, x3Speed = false, false
        local gp = type(data.GamePasses) == "table" and data.GamePasses or {}
        for k, v in pairs(gp) do
            if v then
                local kl = tostring(k):lower()
                -- actual keys: gp_double_seeds, gp_gamespeed_3
                if kl:find("double_seed") or kl:find("2x") or kl:find("doubleseed") or kl:find("x2seed") or kl:find("seedmultip") then x2Seeds = true end
                if kl:find("gamespeed_3") or kl:find("speed_3") or kl:find("3x") or kl:find("triplespeed") or kl:find("x3speed") or kl:find("speedmultip") then x3Speed = true end
            end
        end

        local stateStr = getMapDisplay(sharedItemData)

        local invKey = ""
        for _, item in ipairs(units) do invKey = invKey .. item.id .. "=" .. item.count .. ";" end
        local payloadKey = stateStr .. "|" .. seeds .. "|" .. luckyBlocks .. "|" .. invKey

        local now       = os.time()
        local forceSync = (now - lastForcedSync) >= FORCE_INTERVAL
        if payloadKey == lastPayloadKey and not forceSync then return end
        if forceSync then lastForcedSync = now end

        local body = {
            username     = LP.Name,
            seeds        = seeds,
            lucky_blocks = luckyBlocks,
            units        = #units,
            lobby        = stateStr,
            status       = "online",
            x2_seeds     = x2Seeds,
            x3_speed     = x3Speed,
            inventory    = allItems,
        }

        local rid = ensureRecord(LP.Name)
        local res
        if rid then
            res = pbPatch("/api/collections/gtd_accounts/records/" .. rid, body)
        else
            local createRes = pbPost("/api/collections/gtd_accounts/records", body)
            if createRes and createRes.StatusCode == 200 then
                local ok2, created = pcall(HttpService.JSONDecode, HttpService, createRes.Body)
                if ok2 and created and created.id then
                    pbRecordId = created.id
                end
            end
            res = createRes
        end

        if res and res.StatusCode and res.StatusCode >= 200 and res.StatusCode < 300 then
            lastPayloadKey = payloadKey
            print(string.format("[PB] Synced: %s | seeds: %d | lb: %d | units: %d | %s",
                LP.Name, seeds, luckyBlocks, #units, stateStr))
        else
            if res and res.StatusCode == 404 then pbRecordId = nil end
        end
    end

    -- ── LOOP ──────────────────────────────────────────────────────
    pcall(sendData)
    while true do
        task.wait(SEND_INTERVAL)
        local ok2, err = pcall(sendData)
        if not ok2 then warn("[PB] Loop error:", err) end
    end
end)
`;

export function buildTrackerScript(): string {
  return TRACKER_SCRIPT;
}
