const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
module.exports=function compileFly(){const root=path.resolve(__dirname,'..'),out=path.join(root,'work','virtual-fly-runtime');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}');
  for(const dir of ['domain','scenarios','simulation','virtual-fly']){fs.mkdirSync(path.join(out,dir),{recursive:true});for(const f of fs.readdirSync(path.join(root,'src',dir)).filter(f=>f.endsWith('.ts')))fs.writeFileSync(path.join(out,dir,f.replace(/\.ts$/,'.js')),ts.transpileModule(fs.readFileSync(path.join(root,'src',dir,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
  return name=>require(path.join(out,name+'.js'));
};
