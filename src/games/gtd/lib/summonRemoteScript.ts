/**
 * Embedded copy of ../../../../../gtd-updated-tracker/summon_remote.lua.
 * Kept in sync manually. Handles gtd_summon_config-driven gacha summon
 * looping, auto-buying shop units, and shop-catalogue scraping. Trading
 * (auto_trade) is intentionally NOT handled here - it is owned exclusively
 * by the kaitun script, which runs alongside this one on the same farming
 * accounts; see the comment at the top of ApplyRemoteConfig for why.
 */
const SCRIPT = String.raw`-- ============================================
--  REMOTE CONFIG (pulled from PocketBase)
-- ============================================
local PB_URL = "https://kirayutracker.online"
local CONFIG_POLL_INTERVAL = 5    -- seconds between config re-fetches

-- ============================================
--  LOCAL FALLBACK CONFIG
-- ============================================
-- Trading (auto_trade / trade_target / trade_items) is owned exclusively by
-- GardenTD_Headless_Linux.lua, which runs alongside this script on the same
-- account - this file no longer reads or reacts to those fields, so the two
-- scripts don't both try to send invites/drag the amount slider at once.
local Config = {
    SummonBox     = "Greenhouse Summon",
    SummonAmount  = 10,
    LoopSummon    = false,
    StopSummonAt  = 0,
    BannedUnits   = {},

    AutoBuy       = false,
    BuyUnits      = {},
}

-- ============================================
--  SERVICES
-- ============================================
repeat task.wait() until game:IsLoaded()

local Players     = game:GetService("Players")
local LP          = Players.LocalPlayer
local RS          = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local VIM         = game:GetService("VirtualInputManager")

-- ============================================
--  LOGGER
-- ============================================
local Log = {}
function Log.info(tag, ...)  print("[Kirayu][" .. tag .. "]", ...) end
function Log.warn(tag, ...)  warn("[Kirayu][" .. tag .. "]", ...) end
function Log.err(tag, ...)   warn("[Kirayu][ERR][" .. tag .. "]", ...) end

-- ============================================
--  HTTP
-- ============================================
local requestFunc = request
    or http_request
    or (syn      and syn.request)
    or (fluxus   and fluxus.request)
    or (krnl     and krnl.request)
    or (electron and electron.request)
    or (oxygen   and oxygen.request)

-- ============================================
--  PB HELPERS
-- ============================================
local PB_HEADERS = { ["Content-Type"] = "application/json" }

-- Cached PocketBase record IDs to avoid repeat GETs
local pbAccountId = nil
local pbConfigId  = nil

local function pbGet(path)
    if not requestFunc then return nil end
    local ok, res = pcall(requestFunc, { Url = PB_URL .. path, Method = "GET", Headers = PB_HEADERS })
    if not ok or not res or res.StatusCode ~= 200 then return nil end
    local dok, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
    if dok then return data end
    return nil
end

local function pbPost(path, body)
    if not requestFunc then return nil end
    local ok, res = pcall(requestFunc, {
        Url = PB_URL .. path, Method = "POST", Headers = PB_HEADERS,
        Body = HttpService:JSONEncode(body),
    })
    if ok then return res end
    return nil
end

local function pbPatch(path, body)
    if not requestFunc then return nil end
    local ok, res = pcall(requestFunc, {
        Url = PB_URL .. path, Method = "PATCH", Headers = PB_HEADERS,
        Body = HttpService:JSONEncode(body),
    })
    if ok then return res end
    return nil
end

-- Upsert a single record into a collection by a unique field
local function pbUpsert(collection, uniqueField, uniqueVal, record)
    local filter = "?filter=" .. HttpService:UrlEncode("(" .. uniqueField .. "='" .. uniqueVal .. "')")
    local data = pbGet("/api/collections/" .. collection .. "/records" .. filter)
    if data and data.items and data.items[1] then
        pbPatch("/api/collections/" .. collection .. "/records/" .. data.items[1].id, record)
        return data.items[1].id
    else
        local res = pbPost("/api/collections/" .. collection .. "/records", record)
        if res and res.StatusCode == 200 then
            local ok, created = pcall(HttpService.JSONDecode, HttpService, res.Body)
            if ok and created then return created.id end
        end
    end
    return nil
end

-- ============================================
--  DATA SCRAPERS
-- ============================================
local ClientLoader = LP:WaitForChild("PlayerGui"):WaitForChild("LogicHolder"):WaitForChild("ClientLoader")
local SharedConfig = ClientLoader:WaitForChild("SharedConfig")
local ItemData     = SharedConfig:WaitForChild("ItemData")
local UnitsFolder  = ItemData:WaitForChild("Units")

local UnitNameCache    = {}
local NameToIdCache    = {}
local BoxData          = {}
local ShopUnits        = {}   -- { id, name, price } for units purchasable with Seeds
local WTUnitTraderKey  = {}   -- { ["unit_dandelion"] = "normal", ... } built in ScrapeShopUnits

local function ScrapeUnitNames()
    -- Sequential on 1-core devices: spawning per-module creates ~100 competing coroutines
    -- with no throughput gain. Sequential with periodic yields is faster here.
    local children = UnitsFolder.Configs:GetChildren()
    for i, module in ipairs(children) do
        if module:IsA("ModuleScript") then
            local ok, data = pcall(require, module)
            if ok and data and data.Name then
                UnitNameCache[module.Name] = data.Name
                NameToIdCache[data.Name]   = module.Name
            end
        end
        if i % 20 == 0 then task.wait() end
    end
end

-- Determines which units are purchasable with Seeds and pushes { id, name, price }
-- for each to ShopUnits. Two live sources, both scraped fresh each call — no
-- hardcoded unit-id list to maintain by hand:
--   1. LimitedUnitDisplays — the physical lobby stands (Workspace.Map.
--      LimitedUnitDisplays.Slot*) that show the 1-2 currently-featured limited
--      units (e.g. Hydrobloom Cannon, Surge Root). Each populated slot's
--      Model.Sale part carries a UnitId attribute naming the live item; empty
--      slots mean nothing is on display there right now. This is the actual
--      ground truth — confirmed by reading the live game's own purchase-gate
--      code, which whitelists exactly these same ids for the seeds-buy path.
--      A generic per-unit config scan (SeedsPrice, DevProductID, Tags,
--      RarityCategory) was tried first and rejected: every one of those
--      fields is reused broadly across the whole unit roster for unrelated
--      reasons (sell value, past seasonal items, etc.), producing 70-140
--      false positives against the true ~2 currently-live items.
--   2. WanderingTrader rotation (weekly, seeds + luckyblock traders).
local function ScrapeShopUnits()
    local found = {}
    local seen  = {}

    local function addUnit(id, price)
        if seen[id] then return end
        seen[id] = true
        table.insert(found, {
            id    = id,
            name  = UnitNameCache[id] or id,
            price = type(price) == "number" and price or 0,
        })
    end

    -- ── Limited-time lobby display stands (rotates with each game update) ──
    local SharedItemData = require(ClientLoader.Modules.SharedItemData)
    local displays = workspace:FindFirstChild("Map") and workspace.Map:FindFirstChild("LimitedUnitDisplays")
    if displays then
        for _, slot in ipairs(displays:GetChildren()) do
            local sale = slot:FindFirstChild("Model") and slot.Model:FindFirstChild("Sale")
            local unitId = sale and sale:GetAttribute("UnitId")
            if unitId then
                local ok, item = pcall(SharedItemData.GetItem, unitId)
                if ok and item and item.Params then
                    local p = item.Params
                    addUnit(unitId, p.SeedsPrice or p.Price or 0)
                end
            end
        end
    else
        Log.warn("Shop", "LimitedUnitDisplays not found — no limited-display units this session.")
    end

    -- ── WanderingTrader rotation (weekly, seeds + luckyblock traders) ──
    local ok, WT = pcall(require, ClientLoader.Modules.SharedWanderingTrader)
    if not ok then
        Log.warn("Shop", "Could not load SharedWanderingTrader:", tostring(WT))
    else
        for _, traderKey in ipairs({"normal", "luckyblock"}) do
            local ok2, offer = pcall(WT.GetActiveOffer, traderKey)
            if ok2 and offer and offer.Items then
                for _, item in ipairs(offer.Items) do
                    if item.ItemId then
                        local price = item.SeedsPrice or item.CandyCornsPrice
                            or item.ChristmasGiftsPrice or 0
                        addUnit(item.ItemId, price)
                        WTUnitTraderKey[item.ItemId] = traderKey
                    end
                end
            end
        end
    end

    table.sort(found, function(a, b)
        if a.price ~= b.price then return a.price < b.price end
        return a.name < b.name
    end)
    ShopUnits = found
    if #ShopUnits > 0 then
        local names = {}
        for _, u in ipairs(ShopUnits) do table.insert(names, u.name) end
        Log.info("Shop", "Found " .. #ShopUnits .. " lobby shop units: " .. table.concat(names, ", "))
    else
        Log.warn("Shop", "No lobby units found — website will use hardcoded fallback list.")
    end
end

local function ScrapeBoxData()
    for _, module in ipairs(UnitsFolder.Boxes:GetChildren()) do
        if module:IsA("ModuleScript") and module.Name:find("ub_") then
            local ok, mod = pcall(function() return require(module) end)
            if ok and mod.Load then
                mod.Load({}, function(_, boxId, dataTable)
                    local displayName = dataTable.Name or boxId
                    local units = {}
                    if dataTable.Items then
                        for _, item in ipairs(dataTable.Items) do
                            if item.ID then table.insert(units, item.ID) end
                        end
                    end
                    BoxData[displayName] = { id = boxId, units = units, currency = dataTable.BuyCurrency }
                end)
            end
        end
    end
end

-- Push the shop unit catalogue to PocketBase (upsert each unit by unit_id).
local function PushShopUnits()
    if not requestFunc or #ShopUnits == 0 then return end
    for _, unit in ipairs(ShopUnits) do
        pcall(function()
            pbUpsert("gtd_shop_units", "unit_id", unit.id, {
                unit_id = unit.id,
                name    = unit.name,
                price   = unit.price,
            })
        end)
    end
    Log.info("Shop", "Pushed " .. #ShopUnits .. " shop units to PocketBase.")
end

ScrapeUnitNames()
ScrapeBoxData()

local function uD(id)   return UnitNameCache[id] or id end

-- ============================================
--  HELPERS
-- ============================================
-- Compare two string arrays as unordered sets
local function SetsEqual(a, b)
    if #a ~= #b then return false end
    local set = {}
    for _, v in ipairs(a) do set[v] = true end
    for _, v in ipairs(b) do
        if not set[v] then return false end
    end
    return true
end

local function safeClick(button)
    if not button then return end
    local target = button:IsA("GuiButton") and button or button:FindFirstChildWhichIsA("GuiButton", true)
    if target then
        if firesignal then
            firesignal(target.MouseButton1Click)
            firesignal(target.Activated)
        else
            target:Activate()
        end
    end
end

local _warnDesc = nil
local function GetWarningText()
    if not _warnDesc then
        local pGui = LP:FindFirstChild("PlayerGui")
        local ni   = pGui and pGui:FindFirstChild("GameGuiNoInset")
        local top  = ni and ni.Screen and ni.Screen.Top
        local msg  = top and top:FindFirstChild("Message_text")
        _warnDesc  = msg and msg.Items and msg.Items:FindFirstChild("Desc")
    end
    return (_warnDesc and _warnDesc.Visible and _warnDesc.Text ~= "") and _warnDesc.Text:lower() or ""
end

local function CloseShopUI()
    local pGui     = LP:FindFirstChild("PlayerGui")
    local closeBtn = pGui
        and pGui:FindFirstChild("GameGui")
        and pGui.GameGui.Screen.Middle:FindFirstChild("Shop")
        and pGui.GameGui.Screen.Middle.Shop.Items:FindFirstChild("Close")
    if closeBtn then safeClick(closeBtn) end
end

local function RefreshBanOnServer(boxId, unitId, shouldBeBanned)
    local remote = RS:FindFirstChild("RemoteEvents") and RS.RemoteEvents:FindFirstChild("BanFromUnitBox")
    if not remote then return end
    remote:FireServer(boxId, unitId, false)
    if shouldBeBanned then
        task.wait(0.05)
        remote:FireServer(boxId, unitId, true)
    end
end

local _seedsStat = nil
local function GetSeeds()
    if not _seedsStat then
        local stats = LP:FindFirstChild("leaderstats")
        _seedsStat  = stats and (stats:FindFirstChild("Seeds") or stats:FindFirstChild("Seeds "))
    end
    if not _seedsStat then return 0 end
    -- leaderstats shows abbreviated values like "6.32M" — parse to a real number
    local raw = tostring(_seedsStat.Value)
    local n, suffix = raw:match("^([%d%.]+)([KkMmBb]?)$")
    if not n then return 0 end
    local num = tonumber(n) or 0
    local s   = suffix:upper()
    if     s == "K" then return math.floor(num * 1e3)
    elseif s == "M" then return math.floor(num * 1e6)
    elseif s == "B" then return math.floor(num * 1e9)
    else                  return math.floor(num) end
end

-- ============================================
--  PB WRITE-BACK
--  Called when a loop stops naturally so the
--  website reflects the real state and the next
--  poll does NOT restart the loop.
-- ============================================
local function PushLoopSummonState(enabled)
    Config.LoopSummon = enabled   -- update local so next poll diff is clean
    if not requestFunc then return end
    pcall(function()
        if pbConfigId then
            pbPatch("/api/collections/gtd_summon_config/records/" .. pbConfigId, { loop_summon = enabled })
        else
            pbUpsert("gtd_summon_config", "username", LP.Name, { username = LP.Name, loop_summon = enabled })
        end
    end)
    Log.info("Config", "Pushed loop_summon=" .. tostring(enabled) .. " back to PocketBase.")
end

-- ============================================
--  REMOTE CONFIG FETCH
-- ============================================
local function FetchRemoteConfig()
    local filter = HttpService:UrlEncode("(username='" .. LP.Name .. "')")
    local data = pbGet("/api/collections/gtd_summon_config/records?filter=" .. filter)
    if not data or not data.items or #data.items == 0 then return nil end
    pbConfigId = data.items[1].id  -- cache the record ID
    return data.items[1]
end

-- Returns: stateChanged (bool), bansChanged (bool)
-- stateChanged = loop on/off, box, amount, stop threshold, auto_buy, buy_units changed
-- bansChanged  = only the banned_units list changed (no loop restart needed)
local function ApplyRemoteConfig(remote)
    if not remote then return false, false end

    local stateChanged = false
    local bansChanged  = false

    -- loop_summon
    local newLoopSummon = remote.loop_summon == true
    if newLoopSummon ~= Config.LoopSummon then
        Config.LoopSummon = newLoopSummon
        stateChanged = true
    end

    -- summon_box
    if remote.summon_box and remote.summon_box ~= Config.SummonBox then
        Config.SummonBox = remote.summon_box
        stateChanged = true
    end

    -- summon_amount
    if remote.summon_amount and remote.summon_amount ~= Config.SummonAmount then
        Config.SummonAmount = remote.summon_amount
        stateChanged = true
    end

    -- stop_summon_at
    if remote.stop_summon_at ~= nil and remote.stop_summon_at ~= Config.StopSummonAt then
        Config.StopSummonAt = remote.stop_summon_at
        stateChanged = true
    end

    -- banned_units — only flag changed if the set actually differs
    if type(remote.banned_units) == "table" then
        if not SetsEqual(remote.banned_units, Config.BannedUnits) then
            Config.BannedUnits = remote.banned_units
            bansChanged = true
        end
    end

    -- auto_buy
    if remote.auto_buy ~= nil then
        local newAutoBuy = remote.auto_buy == true
        if newAutoBuy ~= Config.AutoBuy then
            Config.AutoBuy = newAutoBuy
            stateChanged = true
        end
    end

    -- buy_units
    if type(remote.buy_units) == "table" then
        if not SetsEqual(remote.buy_units, Config.BuyUnits) then
            Config.BuyUnits = remote.buy_units
            stateChanged = true
        end
    end

    return stateChanged, bansChanged
end

-- ============================================
--  REMOTE FUNCTION CACHE
--  Cached once so hot loops avoid repeated table indexing.
-- ============================================
local RF = RS:WaitForChild("RemoteFunctions")
local RF_BuyUnitBox        = RF:WaitForChild("BuyUnitBox")
local RF_BuyUnitWithSeeds  = RF:WaitForChild("BuyUnitWithSeeds")
local RF_WTBuyItem         = RF:WaitForChild("WTBuyItem")

-- ============================================
--  RUNTIME FLAGS  (control running loops)
-- ============================================
local Running = { Summon = false, Buy = false }

-- ============================================
--  CORE LOOPS
-- ============================================
local function StartSummonLoop()
    if Running.Summon then return end
    local data = BoxData[Config.SummonBox]
    if not data then
        Log.err("Summon", "Box not found:", Config.SummonBox)
        return
    end

    -- Apply bans before the first pull
    if #Config.BannedUnits > 0 then
        local prettyBanned = {}
        for _, id in ipairs(Config.BannedUnits) do
            RefreshBanOnServer(data.id, id, true)
            table.insert(prettyBanned, uD(id))
        end
        Log.info("Summon", "Banned:", table.concat(prettyBanned, ", "))
    end

    Log.info("Summon", "Box:", Config.SummonBox, "| Amount:", Config.SummonAmount)
    Running.Summon = true

    if pbAccountId then
        pcall(pbPatch, "/api/collections/gtd_accounts/records/" .. pbAccountId, { status = "summoning" })
    end

    -- Cache locals so the hot loop avoids repeated table lookups
    local boxId        = data.id
    local amount       = Config.SummonAmount
    local thresh       = Config.StopSummonAt
    local pullCount    = 0
    local SEEDS_EVERY  = 50  -- push seeds to dashboard every N pulls

    task.spawn(function()
        while Running.Summon do
            -- Only call GetSeeds when a stop threshold is set (common case: thresh=0, skip entirely)
            if thresh > 0 then
                local s = GetSeeds()
                if s <= thresh then
                    Log.warn("Summon", "Seeds at " .. s .. " — threshold reached, stopping.")
                    CloseShopUI()
                    Running.Summon = false
                    task.spawn(PushLoopSummonState, false)
                    break
                end
            end

            pcall(RF_BuyUnitBox.InvokeServer, RF_BuyUnitBox, boxId, amount)
            pullCount = pullCount + amount
            task.wait(0.15)

            -- Periodically push current seeds so the dashboard stays fresh
            if pullCount % SEEDS_EVERY == 0 and pbAccountId then
                pcall(pbPatch, "/api/collections/gtd_accounts/records/" .. pbAccountId, {
                    seeds = GetSeeds(), status = "summoning"
                })
            end
        end

        -- Push final seeds + reset status when loop exits
        if pbAccountId then
            pcall(pbPatch, "/api/collections/gtd_accounts/records/" .. pbAccountId, {
                seeds = GetSeeds(), status = "online"
            })
        end
        Log.info("Summon", "Loop exited. Total pulls this session:", pullCount)
    end)
end

local function StopSummonLoop()
    if Running.Summon then
        Running.Summon = false
        Log.info("Summon", "Loop stop requested (will exit on next tick).")
    end
end

local MaxedUnits = {}

local function StartBuyLoop()
    if Running.Buy then return end
    if #Config.BuyUnits == 0 then
        Log.warn("Buyer", "No units configured to buy.")
        return
    end
    Running.Buy = true
    local pretty = {}
    for _, id in ipairs(Config.BuyUnits) do table.insert(pretty, uD(id)) end
    Log.info("Buyer", "Units:", table.concat(pretty, ", "))

    task.spawn(function()
        while Running.Buy do
            for _, id in ipairs(Config.BuyUnits) do
                if not Running.Buy then break end
                if MaxedUnits[id] then continue end
                local traderKey = WTUnitTraderKey[id]
                if traderKey then
                    pcall(RF_WTBuyItem.InvokeServer, RF_WTBuyItem, traderKey, id)
                else
                    pcall(RF_BuyUnitWithSeeds.InvokeServer, RF_BuyUnitWithSeeds, id)
                end
                task.wait(0.4)
                local msg = GetWarningText()
                if msg:find("3 times") or msg:find("stock") or msg:find("circulation") then
                    MaxedUnits[id] = true
                    Log.warn("Buyer", "Maxed/out of stock:", uD(id))
                elseif msg:find("can't buy") or msg:find("afford") then
                    Log.warn("Buyer", "Out of currency, stopping.")
                    CloseShopUI()
                    Running.Buy = false
                    return
                end
            end
            -- All units maxed? Stop.
            local allMaxed = true
            for _, id in ipairs(Config.BuyUnits) do
                if not MaxedUnits[id] then allMaxed = false break end
            end
            if allMaxed then
                Log.info("Buyer", "All configured units maxed out.")
                Running.Buy = false
                return
            end
            task.wait(0.5)
        end
        Log.info("Buyer", "Loop exited.")
    end)
end-- ============================================
--  CONFIG WATCHER  (polls PocketBase every 5s)
-- ============================================
local function ApplyConfigState()
    -- Summon
    if Config.LoopSummon and not Running.Summon then
        Log.info("Config", "Starting summon loop (remote ON).")
        StartSummonLoop()
    elseif not Config.LoopSummon and Running.Summon then
        Log.info("Config", "Stopping summon loop (remote OFF).")
        StopSummonLoop()
    end

    -- Buyer
    if Config.AutoBuy and not Running.Buy then
        StartBuyLoop()
    elseif not Config.AutoBuy and Running.Buy then
        Running.Buy = false
    end
end

local function WatchConfig()
    task.spawn(function()
        while true do
            task.wait(CONFIG_POLL_INTERVAL)
            local remote = FetchRemoteConfig()
            local stateChanged, bansChanged = ApplyRemoteConfig(remote)

            -- Re-apply bans on the server only when the list actually changed.
            -- This avoids the brief unban window that allows banned units to slip through.
            if bansChanged and Running.Summon then
                local data = BoxData[Config.SummonBox]
                if data then
                    Log.info("Config", "Banned units list changed — updating server bans.")
                    for _, id in ipairs(Config.BannedUnits) do
                        RefreshBanOnServer(data.id, id, true)
                    end
                end
            end

            -- Only start/stop loops when the config state actually changed.
            -- If neither changed we skip ApplyConfigState entirely, so a naturally-
            -- stopped loop (out of seeds/currency) is never accidentally restarted.
            if stateChanged then
                Log.info("Config", "Remote config state changed — reapplying.")
                ApplyConfigState()
            end
        end
    end)
end

-- ============================================
--  GAME END TRACKER
--  Event-driven — fires only on actual win/defeat, no polling cost.
-- ============================================
local GamesWon = 0  -- session counter; seeded from DB at startup

local function PushGameResult(isVictory, wavesCleared)
    if not requestFunc then return end
    if isVictory then GamesWon = GamesWon + 1 end
    local body = { wave = wavesCleared }
    if isVictory then body.games_won = GamesWon end
    if pbAccountId then
        pcall(pbPatch, "/api/collections/gtd_accounts/records/" .. pbAccountId, body)
    end
    Log.info("GameEnd", (isVictory and "Victory" or "Defeat") .. " — waves=" .. wavesCleared .. (isVictory and " games_won=" .. GamesWon or ""))
end

local function WatchGameEnd()
    -- Wait for the GameEnd frame to exist in the GUI
    local pGui   = LP:WaitForChild("PlayerGui")
    local gameGui = pGui:WaitForChild("GameGui")
    local screen = gameGui:WaitForChild("Screen")
    local middle = screen:WaitForChild("Middle")
    local gameEnd = middle:WaitForChild("GameEnd")

    gameEnd:GetPropertyChangedSignal("Visible"):Connect(function()
        if not gameEnd.Visible then return end
        task.wait(0.3)  -- let labels populate

        local frame = gameEnd:FindFirstChild("Items") and gameEnd.Items:FindFirstChild("Frame")
        if not frame then return end

        -- Determine outcome
        local defeatBanner = frame:FindFirstChild("Defeat")
        local victoryBanner = frame:FindFirstChild("Victory")
        local isVictory = victoryBanner and victoryBanner.Visible

        -- Parse waves cleared from txt labels
        local wavesCleared = 0
        local itemsContainer = frame:FindFirstChild("Items") and frame.Items:FindFirstChild("Items")
        if itemsContainer then
            for _, v in ipairs(itemsContainer:GetChildren()) do
                if v:IsA("TextLabel") then
                    local n = v.Text:match("[Cc]leared%s+(%d+)%s+waves?")
                    if n then wavesCleared = tonumber(n) or 0 end
                end
            end
        end

        task.spawn(PushGameResult, isVictory, wavesCleared)
    end)

    Log.info("Init", "Game-end tracker active.")
end

-- ============================================
--  STARTUP
-- ============================================
task.spawn(function()
    repeat task.wait(0.5) until LP.Character and LP:FindFirstChild("PlayerGui")
    task.wait(1)

    Log.info("Init", "Scraping shop units...")
    ScrapeShopUnits()
    task.spawn(PushShopUnits)   -- push in background, don't block startup

    Log.info("Init", "Fetching remote config for:", LP.Name)
    local remote = FetchRemoteConfig()
    if remote then
        local stateChanged, bansChanged = ApplyRemoteConfig(remote)
        _ = stateChanged or bansChanged  -- silence unused warning
        Log.info("Init", "Remote config loaded. LoopSummon =", tostring(Config.LoopSummon), "| Box:", Config.SummonBox, "| AutoBuy =", tostring(Config.AutoBuy))
    else
        Log.warn("Init", "No remote config found — using local defaults. Configure on website first.")
    end

    -- Seed GamesWon and cache account record ID from PocketBase
    pcall(function()
        local filter = HttpService:UrlEncode("(username='" .. LP.Name .. "')")
        local data = pbGet("/api/collections/gtd_accounts/records?filter=" .. filter)
        if data and data.items and data.items[1] then
            pbAccountId = data.items[1].id
            if type(data.items[1].games_won) == "number" then
                GamesWon = data.items[1].games_won
                Log.info("Init", "GamesWon seeded from DB:", GamesWon)
            end
        end
    end)

    ApplyConfigState()
    WatchConfig()
    task.spawn(WatchGameEnd)

    pcall(function()
        VIM:SendKeyEvent(true,  Enum.KeyCode.RightControl, false, game)
        VIM:SendKeyEvent(false, Enum.KeyCode.RightControl, false, game)
    end)
end)
`;

export function buildSummonRemoteScript(): string {
  return SCRIPT;
}
