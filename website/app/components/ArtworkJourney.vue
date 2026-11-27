<script setup lang="ts">
import { getArtwork } from '~/data/artworks';
const artwork=getArtwork('terra-in-balance')!;
const area=ref<HTMLElement|null>(null),stage=ref<HTMLElement|null>(null),canvas=ref<HTMLCanvasElement|null>(null);
const enhanced=ref(false),frame=ref(0);
const {paused}=useMotionPreference();
const phase=computed(()=>frame.value<42?0:frame.value<88?1:2);
const titles=['Every surface holds a story.','A gesture, made whole.','Imagine it in your world.'];
let observer:IntersectionObserver|undefined,dispose:(()=>void)|undefined,seekFrame:((n:number)=>void)|undefined;
let generation=0,near=false,alive=true;
const blend=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(t:number)=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
async function setup(){
 const run=++generation;dispose?.();dispose=undefined;seekFrame=undefined;enhanced.value=false;
 await nextTick();window.dispatchEvent(new Event("exhibition:layout"));
 if(paused.value||!near||!alive)return;
 const load=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
 try{
 const [art,room,{gsap},{ScrollTrigger}]=await Promise.all([load('/images/terra-1600.webp'),load('/images/gallery-wall-1600.webp'),import('gsap'),import('gsap/ScrollTrigger')]);
 if(run!==generation||paused.value||!alive||!canvas.value||!stage.value||!area.value)return;
 const ctx=canvas.value.getContext('2d');if(!ctx)return;
 gsap.registerPlugin(ScrollTrigger);
 const node=canvas.value,viewport=stage.value;
 const draw=()=>{
  const width=viewport.clientWidth,height=viewport.clientHeight,dpr=Math.min(window.devicePixelRatio||1,1.5);
  if(node.width!==Math.round(width*dpr)||node.height!==Math.round(height*dpr)){node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const p=frame.value/120,first=ease(p/.6),last=ease((p-.6)/.4);
  ctx.fillStyle='#24231e';ctx.fillRect(0,0,width,height);
  if(last>0){ctx.globalAlpha=last;const scale=Math.max(width/room.width,height/room.height);ctx.drawImage(room,(width-room.width*scale)/2,(height-room.height*scale)/2,room.width*scale,room.height*scale);ctx.globalAlpha=1;}
  const cover=Math.max(width/art.width,height/art.height)*1.8;
  const fit=Math.min(width*.6/art.width,height*.65/art.height);
  const final=Math.min(width*(width<700?.50:.25)/art.width,height*.47/art.height);
  const scale=blend(blend(cover,fit,first),final,last);
  const w=art.width*scale,h=art.height*scale;
  const cx=blend(width*.5,width*(width<700?.5:.56),last),cy=blend(height*.47,height*.43,last);
  ctx.save();ctx.shadowColor=`rgba(0,0,0,${.4*first})`;ctx.shadowBlur=26*first;ctx.shadowOffsetY=12*first;
  const border=blend(0,Math.max(3,width*.003),first);
  ctx.fillStyle='#3d2d22';ctx.fillRect(cx-w/2-border,cy-h/2-border,w+border*2,h+border*2);ctx.restore();
  ctx.drawImage(art,cx-w/2,cy-h/2,w,h);
 };
 enhanced.value=true;await nextTick();if(run!==generation||!alive)return;
 const trigger=ScrollTrigger.create({trigger:area.value,start:'top top',end:'bottom bottom',onUpdate(self){frame.value=Math.round(self.progress*120);draw();}});
 seekFrame=(n)=>{const position=trigger.start+(trigger.end-trigger.start)*(n/120);window.dispatchEvent(new CustomEvent('exhibition:seek',{detail:position}));window.scrollTo({top:position,behavior:'instant'});};
 const resize=new ResizeObserver(()=>{draw();trigger.refresh();});resize.observe(viewport);
 draw();window.dispatchEvent(new Event('exhibition:layout'));
 dispose=()=>{resize.disconnect();trigger.kill();ctx.clearRect(0,0,node.width,node.height);window.dispatchEvent(new Event('exhibition:layout'));};
 }catch{/* The complete static artwork remains available when enhanced media cannot load. */}
}
function seek(event:Event){seekFrame?.(Number((event.target as HTMLInputElement).value));}
function jump(n:number){seekFrame?.(n);}
onMounted(()=>{
 observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!near){near=true;void setup();}},{rootMargin:'500px'});
 if(area.value)observer.observe(area.value);
 const stop=watch(paused,()=>void setup());onScopeDispose(stop);
});
onBeforeUnmount(()=>{alive=false;generation++;observer?.disconnect();dispose?.();});
</script>
<template>
 <section id="artwork-journey" class="artwork-journey" aria-labelledby="journey-title">
  <div class="journey-intro page-gutter"><div><p class="eyebrow">An encounter with one work</p><ArtHeading id="journey-title" text="Stay with the details." /></div><p>From the smallest mark<br>to the space it belongs in.</p></div>
  <div ref="area" class="journey-scroll" :class="{'is-enhanced':enhanced}">
   <div ref="stage" class="journey-stage" :class="{'in-room':phase===2&&enhanced}">
    <div class="journey-static" :class="{'is-hidden':enhanced}"><ArtImage image="terra" :alt="artwork.alt" :width="1122" :height="1402" sizes="(max-width:700px) 85vw,50vw" /></div>
    <canvas v-show="enhanced" ref="canvas" class="journey-canvas" aria-hidden="true"></canvas>
    <div class="journey-top"><p class="eyebrow">Terra, in balance <span>Original work</span></p><a href="#journey-end" class="journey-skip">Skip sequence</a></div>
    <div class="journey-caption"><p v-if="enhanced" class="journey-frame-label">{{ String(frame+1).padStart(3,'0') }} / 121</p><h3>{{ enhanced ? titles[phase] : 'A gesture, made whole.' }}</h3><p v-if="!enhanced" class="journey-static-note">Mineral pigment and plaster on canvas. 80 × 100 cm.</p></div>
    <div v-if="enhanced" class="journey-controls" data-lenis-prevent>
      <div class="journey-chapters" role="group" aria-label="Artwork sequence chapters"><button type="button" :aria-pressed="phase===0" @click="jump(0)">The surface</button><button type="button" :aria-pressed="phase===1" @click="jump(65)">The work</button><button type="button" :aria-pressed="phase===2" @click="jump(120)">The space</button></div>
      <label class="journey-range"><span class="sr-only">Artwork sequence position</span><input type="range" min="0" max="120" :value="frame" :aria-valuetext="`${titles[phase]} Frame ${frame+1} of 121`" @input="seek"></label>
      <span class="journey-hint">Scroll to explore. Reverse to return.</span>
    </div>
   </div>
  </div>
  <div id="journey-end" class="journey-end page-gutter"><div><span class="eyebrow">Terra, in balance</span><p>Earth, space, and the trace of a hand.</p></div><div class="journey-actions"><SaveArtworkButton artwork-id="terra-in-balance"/><NuxtLink to="/artworks/terra-in-balance" class="underlined-link">Explore this artwork <span aria-hidden="true">↗</span></NuxtLink></div></div>
 </section>
</template>
