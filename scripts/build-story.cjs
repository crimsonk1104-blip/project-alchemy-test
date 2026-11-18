const fs=require('node:fs'),path=require('node:path');const root=path.join(__dirname,'..'),file=path.join(root,'v0.2.html');let html=fs.readFileSync(file,'utf8');
for(const [name,start,end,wrap] of [['story-data.js','<!-- STORY_DATA:START -->','<!-- STORY_DATA:END -->',true],['story-runtime.js','  // STORY_RUNTIME:START','  // STORY_RUNTIME:END',false]]){
 const source=fs.readFileSync(path.join(root,name),'utf8');if(/<\/script/i.test(source))throw Error('Unsafe script terminator');new Function(source);
 const a=html.indexOf(start),b=html.indexOf(end);if(a<0||b<a)throw Error('Missing story markers');html=html.slice(0,a)+start+'\n'+(wrap?'<script>\n':'')+source+(wrap?'</script>\n':'\n')+html.slice(b);
}
if(process.argv.includes('--check')){if(html!==fs.readFileSync(file,'utf8'))throw Error('Stale story bundle');console.log('PASS story bundle');}else fs.writeFileSync(file,html);
