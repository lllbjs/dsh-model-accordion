//#region src/bin.d.ts
/**
 * Standalone status/diagnostics CLI for the dsh-connect-qoder bundle.
 *
 * 参考：dsh-connect-workbuddy（MIT，Copyright (c) 2026 LaoDing）——三个子命令
 * 的骨架（`doctor` / `status` / `logout`）、`--json` 输出、`safeMessage` 脱敏与
 * 「凭据来源 + 上游连通性」诊断的结构由该项目设计。
 * 改动（按 Qoder 上游的现实）：
 *   - 凭据只读环境变量 + 本地 vault（CLI 运行于宿主之外，无法访问设置服务）；
 *   - `doctor` 增加 cosy 指纹派生自检、pi-ai 代际、宿主心跳存活、vault 账号计数；
 *   - `status` 汇报每区域凭据来源 + 上游可达性 + 当前剩余积分（总额）；
 *   - `logout` 清除本区域的 vault 凭据与账号池测量副本（可 `--region` 指定，
 *     否则两区域都清）。
 *
 * @module dsh-connect-qoder/bin
 */
/**
 * 从 argv 里取出**命令词**：剥掉 flag 与区域实参，剩下的第一个就是。
 *
 * 必须是「保留**不是** flag、**不是**区域名的实参」。写反成
 * `REGION_KEYS.includes(arg)`（只留 cn/global）会让命令词自己被过滤掉，
 * 于是三条子命令全部只会打印 usage。抽成纯函数就是为了能对它断言。
 */
declare function commandArgOf(argv: readonly string[]): string | undefined;
//#endregion
export { commandArgOf };