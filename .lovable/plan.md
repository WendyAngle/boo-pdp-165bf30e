# 合并方案：社媒触达（Social Outreach）

将「社媒搜索加友」与「社媒私信触达」整合为一个模块「社媒触达」，同时保留全部既有功能（搜索加友任务、任务详情、好友池、私信任务、AI 生成私信等）。

## 一、为什么合并 & 设计思路

当前两个模块本质是**同一条触达链路的两个阶段**：

```text
关键词搜索  →  加好友  →  好友池（沉淀）  →  发私信  →  回复/转询盘
   [加友任务]              [好友池]           [私信任务]
```

分成三个侧栏项时，用户要在三个页面之间来回跳（新建加友任务在 A 页、看好友在 B 页、发私信在 C 页），且"目标来源=某加友任务"这层业务关系被侧栏割裂。

合并后侧栏只保留 **"社媒触达"** 一项，内部用 **Tabs 组织三个阶段视图**，业务对象（任务、好友）不变，路由收敛，交叉跳转（如"好友池 → 批量私信"）不再切换侧栏高亮。

## 二、信息架构

侧栏（出海触达 分组）：

```text
- 社媒账号        （不变，账号资产管理）
- 社媒触达  ⬅ 合并后的入口
```

`/outreach/social/reach` 页面内 3 个 Tab：

```text
[① 加友任务]   [② 好友池]   [③ 私信任务]
   搜索加友         沉淀 & 分发        私信下发
```

顶部保留统一的 Page Header Banner：模块名 + 今日 FB / TikTok 加友剩余额度 + 账号池平均健康度 + 主 CTA（随 Tab 切换：新建加友任务 / 批量发私信 / 新建私信任务）。

## 三、每个 Tab 保留的能力（全量继承，无功能删减）

### Tab ① 加友任务
- 复用现有 `prospecting/index` 列表：任务名、平台、关键词、状态、进度（已请求/已通过徽章可点跳详情）、积分（已用/冻结）、创建时间
- 「新建加友任务」弹窗完全保留（含可用账号明细：可用 X · 养号中 X · 异常 X）
- 任务详情页 `prospecting/$taskId` 路径不变，仍支持 `?status=requested|accepted` 过滤

### Tab ② 好友池
- 复用现有 `social.friends` 全部能力：多选、平台/来源筛选、搜索
- 保留「批量发起私信」——在当前页原地打开 `CreateDmDialog`（不切侧栏），成功后自动跳到 Tab ③

### Tab ③ 私信任务
- 复用现有 `social.dm` 列表：任务、平台、模版预览、进度、状态
- 「新建私信任务」弹窗完全保留（AI 生成内容 + 变量 + 预览 + 目标来源=好友池/加友任务）

## 四、跨 Tab 联动（合并带来的增益）

1. 加友任务详情里「已通过 N」→ 一键"从这批好友建私信任务"（预填目标来源=该任务）
2. 好友池选中 → 批量私信原地打开，不再需要跳侧栏
3. 私信任务列表里的"目标来源"支持点回加友任务详情/好友池筛选视图

## 五、技术实施要点（给开发看）

1. 新建父路由 `src/routes/_app.outreach.social.reach.tsx`（带 `<Outlet />` 与 Tabs 头），Tab 通过 `useMatchRoute` 或 pathname 判断高亮
2. 迁移路由文件（保留内部实现，仅换路径）：
   - `_app.outreach.social.prospecting.index.tsx` → `_app.outreach.social.reach.prospecting.index.tsx`
   - `_app.outreach.social.prospecting.$taskId.tsx` → `_app.outreach.social.reach.prospecting.$taskId.tsx`
   - `_app.outreach.social.friends.tsx` → `_app.outreach.social.reach.friends.tsx`
   - `_app.outreach.social.dm.tsx` → `_app.outreach.social.reach.dm.tsx`
   - 默认 index 重定向到 `./prospecting`
3. 更新所有 `<Link to=...>` 与 `AppSidebar` 菜单项；旧 `/outreach/social/{prospecting,friends,dm}` 路径添加 redirect 兼容书签
4. 侧栏 `AppSidebar.tsx`：把原三项合并成一项「社媒触达」，图标沿用 Send/Users 系
5. 不改动数据层（`social-tasks.ts`、`social-friends.ts`、`social-accounts.ts`、credits ledger），零数据迁移

## 六、验收
- 侧栏只剩「社媒账号」+「社媒触达」两项
- 三个 Tab 之间切换保持侧栏高亮不变
- 好友池「批量发起私信」在同页打开弹窗，不切侧栏
- 加友任务详情"已请求/已通过"跳转仍生效
- 旧 URL 访问自动 302 到新路径
