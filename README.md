# 层迹 STRATA · 左家山本地原型

2026-10-06 新增本地地图整合入口：`http://127.0.0.1:4317/v06b/map/index.html`。看完左家山三处观察并完成本章，可选择进入现成一期 3D 漫游，随后返回原地图章节。其他三处保留筹备状态。原 v06b 发布文件独立留存，构建可重复生成整合版，线上隧道未修改。见 [地图接入与逐场景计划](docs/地图阶段与3D场景接入计划.md)。

照片与展签识别 → 吉林资料库匹配 → 确认区域距离 → 独立的左家山一期漫游页。长期路线和每步备份见 [开发路线与进度](docs/开发路线与进度.md)。交给下一棒的短说明见 [交接说明](docs/交接说明.md)。当前左家山版本怎么复制、改哪一处，见 [左家山当前版本](docs/左家山当前版本.md)。

## 运行

要求 macOS、Node.js 22+、Xcode Command Line Tools（照片 OCR 使用 Apple Vision）。三维查看器使用本地打包的 Three.js 与 SparkJS。

```sh
npm run ocr:build
npm install
npm run build
npm start
```

打开 http://127.0.0.1:4317 。运行 `npm test` 验证资料来源关联、匹配及距离边界。

`.env.local` 为本机服务端配置，权限为 600，已被 `.gitignore` 排除。可参考 `.env.example` 设置 `WORLDLABS_API_KEY` 和 `TRIPO_API_KEY`。静态文件只按白名单提供，不暴露环境文件或项目目录。

## 已实现

- JPG/PNG/HEIC 上传、本机 Vision OCR；OCR 结果可修正；临时文件在请求结束时删除。浏览器可能无法预览 HEIC，但本机 OCR 可读取。
- 左家山原始展签样本（使用可见的 Quick Look PNG，旧 thumbnails 目录有黑图，未使用）。
- 基于核对资料的本地关键词检索，未命中不自动编造归属。已知范围：左家山、九台腰岭子。
- 事实、推断、未知分级，逐条可追溯来源；白名单官方/机构资料可达性刷新。
- 主动请求一次性定位或手选城区；距离为包含粗略位置误差的范围。数据是城区参考点，**不是遗址精确坐标、已核验保护范围或导航地图**。
- World Labs `GET /marble/v1/credits` 与 Tripo v3 `GET /account/balance` 服务端只读连接测试；仅返回鉴权结果，不返回密钥/余额原始响应。
- 下载场景简报 JSON，不含用户坐标或密钥。
- “重构记录”限定为左家山一期后段：地方志和用户展签约束解释范围。当前 03 漫游使用一张**不含房屋、陶器与人物**的 GPT 河岸环境图生成新的 Marble 1.1 Plus 世界；旧版资产保留在本地备份，不在网站切换版本。
- 新的 03 漫游：World Labs 提供河岸远景 SPZ 与配套三维碰撞资产；近处使用一整块横向约 12 米、逐点贴合 World Labs 地形并在边缘淡出的 Tripo 地面 GLB，行走射线取这块 GLB 的表面高度。Tripo 房屋、陶罐与深浅草分别落在该表面；房屋和陶罐可近距离点击查看依据、推测与非原位说明。已取消曾造成黑色断层的远景遮罩，并校正房屋与陶罐的展示比例。世界使用自己的米制比例，不沿用旧世界坐标。详见 [本次装配记录](docs/纯河岸世界与独立近景平台.md)。
- 生活化装配：原版小物件在成人视角几乎看不见，现改为房前左侧较明显的枝材堆和示意作业区，03 画面显示“近景试排 v2”；这一版**仍待用户视觉验收**。新生成的半地穴屋模型因土台与屋体融合未上线。人物三视图和四格表情图已单独备存。随后已把绑定站姿向导放进 03 漫游：行走使用 CC0 走路循环，讲解口部仍是示意张合。详见 [生活化场景记录](docs/左家山生活化场景装配v1.md)和[人物阶段计划](docs/左家山人物向导三视图与动作计划.md)。
- 历史实验：四项 Tripo 图生 3D 任务实际消耗 120 credits；此前 A/B 留空世界生成曾三次返回通用失败。原实验的输入、状态和快照仍在本地，网页不再展示 A/B 控件。见 [近景拆件记录](docs/近景拆件测试记录.md)与 [A/B 失败记录](docs/坐标配准AB测试.md)。
- Tripo 整景单体模型试验质量不足，已从网站移除。其源文件仅在 `outputs/` 与变更前备份中保留，不再通过网站提供，也不会重新提交生成任务。
- 浏览器从本机加载场景/物件；如果三维渲染失败，退回预览图与 Marble 世界链接。当前尚未完成实机视觉和碰撞验收。

## 生成费用与证据边界

World Labs `marble-1.1` 的旧版文字任务和新版图像任务各约 1,580 credits；`marble-1.1-plus` 非全景图像任务预计 1,580–3,080 credits；Tripo `v3.1` 文字到带标准纹理的陶罐模型约 20 credits，图像到标准贴图的整景单体模型约 30 credits。实际扣费以任务结果为准。`/api/generation/*/start` 是付费调用，普通只读鉴权按钮不会计费。

目前找不到可信的史前现场影像。当前世界采用**考古记录约束的 GPT 无建筑河岸环境图 → World Labs 图像生成远景 → Tripo 独立近景装配**。这不是当时河岸的实测地形。屋顶、植被与物件微位置都属于模型补全；页面始终标为“解释性场景 / 类型示意”，不称为原貌或原器扫描。陶罐的位置是教学示意，不代表发掘出土原位。本次 World Labs 新世界实际消耗 3,080 credits。

## 尚未实现

全网自动检索、图片语义器物鉴定、摄像头 AR 锚定、海外同时段对照、多人账户，以及考古坐标级的 World Labs/Tripo 配准仍未实现。更细的分地表脚步、音素口型和双语讲解仍属于后续里程碑。

## 数据质量

之前的看展 PDF/HTML 有同名腰岭子混用、农业占比与符号意义推断偏强等问题，不能整体作为事实库。当前左家山卡已对照 IMG_3043 原始展签，保留未校正/未知口径年代，不将其自动换算公元纪年。九台腰岭子仅作为报道线索。

目前服务器只监听本机，适合本地试用。公开部署前需补充身份验证、会话隔离、上传限流和机构授权等发布工作。

## 官方 API 参考

- https://docs.worldlabs.ai/api/reference/credits/get
- https://docs.worldlabs.ai/api/reference/worlds/generate
- https://docs.worldlabs.ai/api （本地图片先 `media-assets:prepare_upload`，上传后以 `media_asset_id` 生成世界）
- https://docs.worldlabs.ai/api/pricing
- https://developers.tripo3d.ai/en/docs/account
- https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard
- https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard
- https://developers.tripo3d.ai/en/docs/files
- https://developers.tripo3d.ai/en/docs/task-query
