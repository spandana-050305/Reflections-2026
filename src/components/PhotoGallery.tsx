'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

const photos = [
  { src: '/photos/photo1.jpg', alt: 'Reflections team' },
  { src: '/photos/photo2.jpg', alt: 'Reflections stage' },
  { src: '/photos/photo3.jpg', alt: 'Reflections performance' },
  { src: '/photos/photo4.jpg', alt: 'Reflections 23 stage' },
  { src: '/photos/photo5.jpg', alt: 'Reflections highlights' },
  { src: '/photos/photo6.jpg', alt: 'Reflections moments' },
  { src: '/photos/photo7.jpeg', alt: 'Reflections event' },
  { src: '/photos/photo8.jpeg', alt: 'Reflections participants' },
  { src: '/photos/photo9.jpeg', alt: 'Reflections celebration' },
]

export default function PhotoGallery() {
  const [lightbox, setLightbox] = useState<string | null>(null)

  function open(src: string) { setLightbox(src) }
  function close() { setLightbox(null) }

  return (
    <>
      {/* Bento grid */}
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 gap-3" style={{ gridTemplateRows: '200px 180px 180px' }}>

        <div className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden shadow-md cursor-pointer" onClick={() => open(photos[0].src)}>
          <Image src={photos[0].src} alt={photos[0].alt} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="600px" />
        </div>

        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden shadow-md cursor-pointer" onClick={() => open(photos[1].src)}>
          <Image src={photos[1].src} alt={photos[1].alt} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="300px" />
        </div>

        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden shadow-md cursor-pointer" onClick={() => open(photos[2].src)}>
          <Image src={photos[2].src} alt={photos[2].alt} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="300px" />
        </div>

        <div className="col-span-1 row-span-1 relative rounded-2xl overflow-hidden shadow-md cursor-pointer" onClick={() => open(photos[3].src)}>
          <Image src={photos[3].src} alt={photos[3].alt} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="250px" />
        </div>

        <div className="col-span-2 row-span-1 relative rounded-2xl overflow-hidden shadow-md cursor-pointer" onClick={() => open(photos[4].src)}>
          <Image src={photos[4].src} alt={photos[4].alt} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="500px" />
        </div>
      </div>

      {/* Second row */}
      <div className="max-w-5xl mx-auto px-4 mt-3 grid grid-cols-3 gap-3" style={{ gridTemplateRows: '200px' }}>
        {[photos[5], photos[6], photos[7]].map((p, i) => (
          <div key={i} className="col-span-1 relative rounded-2xl overflow-hidden shadow-md cursor-pointer" onClick={() => open(p.src)}>
            <Image src={p.src} alt={p.alt} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="300px" />
          </div>
        ))}
      </div>

      {/* Full-width last photo */}
      <div className="max-w-5xl mx-auto px-4 mt-3 cursor-pointer" onClick={() => open(photos[8].src)}>
        <div className="relative rounded-2xl overflow-hidden shadow-md h-56 sm:h-72">
          <Image src={photos[8].src} alt={photos[8].alt} fill className="object-cover object-top hover:scale-105 transition-transform duration-500" sizes="1000px" />
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 z-10"
          >
            <X size={22} />
          </button>
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={lightbox}
              alt="Enlarged photo"
              width={1200}
              height={800}
              className="w-full h-auto object-contain max-h-[90vh]"
              style={{ maxHeight: '90vh' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
