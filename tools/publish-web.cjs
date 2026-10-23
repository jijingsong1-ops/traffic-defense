// 发布当前已提交的网页版；微信文件仅用于冻结校验，不进入网站。
// 使用：node tools/publish-web.cjs（需要 Node.js 24、Git 和 tar）
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const git = (args, cwd = root) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
const run = (command, args, cwd) => execFileSync(command, args, {cwd, stdio: 'inherit'});
const commit = git(['rev-parse', 'HEAD']);
const remote = git(['remote', 'get-url', 'origin']);
const authorName = git(['config', 'user.name']);
const authorEmail = git(['config', 'user.email']);
// 临时仓库也沿用项目针对该远程配置的代理（包含显式禁用代理的空值）。
const proxy = spawnSync('git', ['config', '--get-urlmatch', 'http.proxy', remote], {cwd: root, encoding: 'utf8'});
if (proxy.status !== 0 && proxy.status !== 1) throw Error('无法读取项目网络配置，停止发布。');
const tempRoot = fs.realpathSync(os.tmpdir());
const temporary = fs.mkdtempSync(path.join(tempRoot, 'traffic-defense-pages-'));

try {
  // 只从 Git 提交导出，避免本地临时预览、配置或未提交改动进入发布包。
  const archive = execFileSync('git', ['archive', '--format=tar', commit], {cwd: root, maxBuffer: 128 * 1024 * 1024});
  execFileSync('tar', ['-xf', '-', '-C', temporary], {input: archive});
  run(process.execPath, ['--test', 'tests/game.test.cjs', 'tests/browser.test.cjs', 'tests/navigation.test.cjs', 'tests/sites.test.cjs', 'tests/world-ops.test.cjs'], temporary);
  run(process.execPath, ['--test', '--test-name-pattern=frozen v0.13.0', 'tests/wechat.test.cjs'], temporary);

  const site = path.join(temporary, '_site');
  fs.mkdirSync(site);
  for (const entry of ['index.html', 'src', 'assets']) {
    fs.cpSync(path.join(temporary, entry), path.join(site, entry), {recursive: true});
  }
  const source = fs.readFileSync(path.join(site, 'src/render/browser.js'), 'utf8');
  const version = source.match(/CONFIG\.version\s*=\s*"([^"]+)"/)?.[1];
  if (!version) throw Error('网页版本号缺失，停止发布。');
  fs.writeFileSync(path.join(site, '.nojekyll'), '');
  fs.writeFileSync(path.join(site, 'version.json'), JSON.stringify({version, commit}, null, 2) + '\n');

  // 在独立临时仓库保留发布分支历史，不切换用户工作区，也不使用强制推送。
  git(['init', '--initial-branch=gh-pages'], site);
  git(['config', 'user.name', authorName], site);
  git(['config', 'user.email', authorEmail], site);
  git(['remote', 'add', 'origin', remote], site);
  if (proxy.status === 0) git(['config', 'http.proxy', proxy.stdout.trim()], site);
  if (git(['ls-remote', '--heads', 'origin', 'gh-pages'], site)) {
    git(['fetch', '--depth=1', 'origin', 'gh-pages'], site);
    git(['reset', '--soft', 'FETCH_HEAD'], site);
  }
  git(['add', '--all'], site);
  if (git(['status', '--porcelain'], site)) {
    git(['commit', '-m', `Deploy ${version} from ${commit.slice(0, 7)}`], site);
    run('git', ['push', 'origin', 'HEAD:refs/heads/gh-pages'], site);
  }
  console.log(`已发布 ${version}（${commit.slice(0, 7)}）到 gh-pages，等待 GitHub Pages 部署完成。`);
} finally {
  // 删除范围严格限于本次 mkdtemp 创建的目录，绝不清理项目工作区。
  const cleanup = path.resolve(temporary);
  if (path.dirname(cleanup) !== tempRoot || !path.basename(cleanup).startsWith('traffic-defense-pages-')) {
    throw Error('临时目录安全检查失败，未执行清理。');
  }
  fs.rmSync(cleanup, {recursive: true, force: true});
}
