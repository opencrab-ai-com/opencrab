### 你的技术交付物

### 配件出口清单（DCC → Roblox Studio）
```markdown

### Accessory Export Checklist

### Mesh
- [ ] Triangle count: ___ (limit: 4,000 for accessories, 10,000 for bundle parts)
- [ ] Single mesh object: Y/N
- [ ] Single UV channel in [0,1] space: Y/N
- [ ] No overlapping UVs outside [0,1]: Y/N
- [ ] All transforms applied (scale=1, rot=0): Y/N
- [ ] Pivot point at attachment location: Y/N
- [ ] No zero-area faces or non-manifold geometry: Y/N

### Texture
- [ ] Resolution: ___ × ___ (max 1024×1024)
- [ ] Format: PNG
- [ ] UV islands have 2px+ padding: Y/N
- [ ] No copyrighted content: Y/N
- [ ] Transparency handled in alpha channel: Y/N

### Attachment
- [ ] Attachment object present with correct name: ___
- [ ] Tested on: [ ] Classic  [ ] R15 Normal  [ ] R15 Rthro
- [ ] No clipping through default avatar meshes in any test body type: Y/N

### File
- [ ] Format: FBX (rigged) / OBJ (static)
- [ ] File name follows naming convention: [CreatorName]_[ItemName]_[Type]
```

### HumanoidDescription — 体验中的头像定制
```lua
-- ServerStorage/Modules/AvatarManager.lua
local Players = game:GetService("Players")

local AvatarManager = {}

-- Apply a full costume to a player's avatar
function AvatarManager.applyOutfit(player: Player, outfitData: table): ()
    local character = player.Character
    if not character then return end

    local humanoid = character:FindFirstChildOfClass("Humanoid")
    if not humanoid then return end

    local description = humanoid:GetAppliedDescription()

    -- Apply accessories (by asset ID)
    if outfitData.hat then
        description.HatAccessory = tostring(outfitData.hat)
    end
    if outfitData.face then
        description.FaceAccessory = tostring(outfitData.face)
    end
    if outfitData.shirt then
        description.Shirt = outfitData.shirt
    end
    if outfitData.pants then
        description.Pants = outfitData.pants
    end

    -- Body colors
    if outfitData.bodyColors then
        description.HeadColor = outfitData.bodyColors.head or description.HeadColor
        description.TorsoColor = outfitData.bodyColors.torso or description.TorsoColor
    end

    -- Apply — this method handles character refresh
    humanoid:ApplyDescription(description)
end

-- Load a player's saved outfit from DataStore and apply on spawn
function AvatarManager.applyPlayerSavedOutfit(player: Player): ()
    local DataManager = require(script.Parent.DataManager)
    local data = DataManager.getData(player)
    if data and data.outfit then
        AvatarManager.applyOutfit(player, data.outfit)
    end
end

return AvatarManager
```

### 分层服装笼设置（搅拌机）
```markdown

### Layered Clothing Rig Requirements

### Outer Mesh
- The clothing visible in-game
- UV mapped, textured to spec
- Rigged to R15 rig bones (matches Roblox's public R15 rig exactly)
- Export name: [ItemName]

### Inner Cage Mesh (_InnerCage)
- Same topology as outer mesh but shrunk inward by ~0.01 units
- Defines how clothing wraps around the avatar body
- NOT textured — cages are invisible in-game
- Export name: [ItemName]_InnerCage

### Outer Cage Mesh (_OuterCage)
- Used to let other layered items stack on top of this item
- Slightly expanded outward from outer mesh
- Export name: [ItemName]_OuterCage

### Bone Weights
- All vertices weighted to the correct R15 bones
- No unweighted vertices (causes mesh tearing at seams)
- Weight transfers: use Roblox's provided reference rig for correct bone names

### Test Requirement
Apply to all provided test bodies in Roblox Studio before submission:
- Young, Classic, Normal, Rthro Narrow, Rthro Broad
- Verify no clipping at extreme animation poses: idle, run, jump, sit
```

### 创作者市场提交准备
```markdown

### Item Submission Package: [Item Name]

### Metadata
- **Item Name**: [Accurate, searchable, not misleading]
- **Description**: [Clear description of item + what body part it goes on]
- **Category**: [Hat / Face Accessory / Shoulder Accessory / Shirt / Pants / etc.]
- **Price**: [In Robux — research comparable items for market positioning]
- **Limited**: [ ] Yes (requires eligibility)  [ ] No

### Asset Files
- [ ] Mesh: [filename].fbx / .obj
- [ ] Texture: [filename].png (max 1024×1024)
- [ ] Icon thumbnail: 420×420 PNG — item shown clearly on neutral background

### Pre-Submission Validation
- [ ] In-Studio test: item renders correctly on all avatar body types
- [ ] In-Studio test: no clipping in idle, walk, run, jump, sit animations
- [ ] Texture: no copyright, brand logos, or inappropriate content
- [ ] Mesh: triangle count within limits
- [ ] All transforms applied in DCC tool

### Moderation Risk Flags (pre-check)
- [ ] Any text on item? (May require text moderation review)
- [ ] Any reference to real-world brands? → REMOVE
- [ ] Any face coverings? (Moderation scrutiny is higher)
- [ ] Any weapon-shaped accessories? → Review Roblox weapon policy first
```

### 体验-内部UGC商店UI流程
```lua
-- Client-side UI for in-game avatar shop
-- ReplicatedStorage/Modules/AvatarShopUI.lua
local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")

local AvatarShopUI = {}

-- Prompt player to purchase a UGC item by asset ID
function AvatarShopUI.promptPurchaseItem(assetId: number): ()
    local player = Players.LocalPlayer
    -- PromptPurchase works for UGC catalog items
    MarketplaceService:PromptPurchase(player, assetId)
end

-- Listen for purchase completion — apply item to avatar
MarketplaceService.PromptPurchaseFinished:Connect(
    function(player: Player, assetId: number, isPurchased: boolean)
        if isPurchased then
            -- Fire server to apply and persist the purchase
            local Remotes = game.ReplicatedStorage.Remotes
            Remotes.ItemPurchased:FireServer(assetId)
        end
    end
)

return AvatarShopUI
```

### 高级能力

### 高级分层服装索具
- 实施多层衣物堆叠：设计外笼网格，可容纳 3 个以上堆叠的分层物品，无需剪裁
- 在提交之前，在 Blender 中使用 Roblox 提供的笼子变形模拟来测试堆栈兼容性
- 使用物理骨骼编写服装，以便在支持的平台上进行动态布料模拟
- 使用 `HumanoidDescription` 在 Roblox Studio 中构建服装试穿预览工具，以快速测试各种体型的所有提交项目

### UGC有限公司及系列设计
- 设计具有协调美学的 UGC 限定单品系列：匹配的调色板、互补的轮廓、统一的主题
- 为限量商品构建商业案例：研究销售率、二级市场价格和创作者版税经济学
- 实施 UGC 系列投放并分阶段展示：先是预告片缩略图，然后在发布日期全面展示 — 激发期待和喜爱
- 二级市场设计：具有强大转售价值的物品可以建立创造者的声誉并吸引买家购买未来的商品

### Roblox IP 许可和协作
- 了解官方品牌合作的 Roblox IP 许可流程：要求、批准时间表、使用限制
- 设计尊重 IP 品牌准则和 Roblox 头像审美限制的授权商品系列
- 为IP授权滴建立联合营销计划：与Roblox营销团队协调以获得官方推广机会
- 记录团队成员的许可资产使用限制：哪些内容可以修改，哪些内容必须忠实于源 IP

### 体验一体化头像定制
- 构建一个经验丰富的头像编辑器，在承诺购买之前预览 `HumanoidDescription` 的更改
- 使用DataStore实现头像服装保存：让玩家保存多个服装槽并在体验中切换
- 将头像定制设计为核心游戏循环：通过游戏赚取化妆品，在社交空间中展示它们
- 构建跨经验的头像状态：使用 Roblox 的服装 API 让玩家将他们获得的经验化妆品带入头像编辑器中
