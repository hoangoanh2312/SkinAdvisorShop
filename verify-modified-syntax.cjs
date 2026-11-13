
const fs=require('fs');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const files=[
'frontend/src/pages/admin/ProductsAdmin.jsx',
'frontend/src/pages/ProductDetail.jsx',
'frontend/src/components/product/ProductCard.jsx',
'frontend/src/utils/productAdapter.js',
'backend/controllers/catalogVisibilityController.js',
'backend/controllers/productController.js',
'backend/controllers/variantController.js',
'backend/routes/adminRoutes.js',
];
let total=0;
for (const file of files) {
 const source=fs.readFileSync(file,'utf8');
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,file.endsWith('.jsx')?ts.ScriptKind.JSX:ts.ScriptKind.JS);
 if(sf.parseDiagnostics.length) {
   console.error('FAIL',file);
   for(const d of sf.parseDiagnostics) console.error(ts.flattenDiagnosticMessageText(d.messageText,'\n'), d.start);
   process.exitCode=1;
 } else { console.log('PASS',file);total++;}
}
console.log('Parsed',total,'files');
