export async function prepareImage(file:File) {
  if(file.size>12*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Selecciona JPG, PNG o WebP de hasta 12 MB.');
  const bitmap=await createImageBitmap(file);
  try {
    let ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    // PNG ignores the quality argument, so also reduce dimensions when necessary.
    for(let attempt=0;attempt<12;attempt++) {
      canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la imagen.');
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,file.type,0.85));
      if(!blob)throw new Error('No se pudo preparar la imagen.');
      if(blob.size<=2*1024*1024) {
        return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer la imagen.'));reader.readAsDataURL(blob);});
      }
      ratio*=0.8;
    }
    throw new Error('No se pudo reducir la imagen. Prueba con otra versión JPG, PNG o WebP.');
  }finally{bitmap.close();}
}
