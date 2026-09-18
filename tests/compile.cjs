const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
module.exports = function compile() {
  const root = path.resolve(__dirname, '..'), output = path.join(root, 'work', 'controller-tests');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  for (const dir of ['domain','scenarios','simulation']) {
    fs.mkdirSync(path.join(output, dir), { recursive: true });
    for (const file of fs.readdirSync(path.join(root, 'src', dir)).filter(f => f.endsWith('.ts'))) {
      fs.writeFileSync(path.join(output, dir, file.replace(/\.ts$/, '.js')), ts.transpileModule(fs.readFileSync(path.join(root,'src',dir,file),'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
    }
  }
  return name => require(path.join(output, 'simulation', `${name}.js`));
};
