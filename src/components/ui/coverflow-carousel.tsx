'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

const carouselData = [
  {
    id: 1,
    image: '/carousel/farmers-market.jpg',
    label: 'Farmers Markets',
    description: 'Support local vendors',
  },
  {
    id: 2,
    image: '/carousel/urban-revitalization.jpg',
    label: 'Urban Revitalization',
    description: 'Neighborhood improvements',
  },
  {
    id: 3,
    image: '/carousel/local-shop.jpg',
    label: 'Local Shops',
    description: 'Small business financing',
  },
  {
    id: 4,
    image: '/carousel/urban-farm.jpg',
    label: 'Urban Farms',
    description: 'City agriculture',
  },
  {
    id: 5,
    image: '/carousel/community-garden.jpg',
    label: 'Community Gardens',
    description: 'Growing together',
  },
  {
    id: 6,
    image: '/carousel/childcare-services.jpg',
    label: 'Childcare Services',
    description: 'Family support',
  },
];

// Calculate position relative to selected index (handles wrapping for loop)
function getRelativePosition(index: number, selectedIndex: number, total: number): number {
  const diff = index - selectedIndex;
  // Handle wrap-around for loop mode
  if (diff > total / 2) return diff - total;
  if (diff < -total / 2) return diff + total;
  return diff;
}

export default function CoverflowCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
    containScroll: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="relative w-full overflow-x-clip" style={{ perspective: '1000px' }}>
      {/* Edge fade overlays - smaller on mobile */}
      <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      {/* Carousel Container */}
      <div className="py-4 md:py-6 pb-8 md:pb-10" ref={emblaRef} style={{ perspectiveOrigin: 'center center' }}>
        <div className="flex" style={{ transformStyle: 'preserve-3d' }}>
          {carouselData.map((item, index) => {
            const relativePos = getRelativePosition(index, selectedIndex, carouselData.length);
            const isSelected = relativePos === 0;
            const isLeft = relativePos < 0;
            const isRight = relativePos > 0;
            const absPos = Math.abs(relativePos);

            // 3D transform values - reduced on mobile for cleaner look
            const rotateY = isSelected ? 0 : isLeft ? 35 : -35;
            const translateZ = isSelected ? 30 : -80 * Math.min(absPos, 2);
            const translateX = isSelected ? 0 : isLeft ? 10 : -10;
            const scale = isSelected ? 1 : Math.max(0.8, 1 - absPos * 0.12);
            const opacity = isSelected ? 1 : Math.max(0.5, 1 - absPos * 0.25);
            const zIndex = isSelected ? 10 : 10 - absPos;

            // Click handler: left cards scroll prev, right cards scroll next
            const handleClick = () => {
              if (isLeft) scrollPrev();
              else if (isRight) scrollNext();
            };

            return (
              <div
                key={item.id}
                className="flex-[0_0_85%] sm:flex-[0_0_75%] md:flex-[0_0_50%] lg:flex-[0_0_45%] min-w-0 px-2 sm:px-3"
                style={{
                  transformStyle: 'preserve-3d',
                  zIndex,
                }}
              >
                <div
                  onClick={handleClick}
                  className={`relative h-[180px] sm:h-[220px] md:h-[300px] rounded-2xl sm:rounded-[28px] border border-border/50 bg-card shadow-lg overflow-hidden ${
                    !isSelected ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    transform: `perspective(1000px) rotateY(${rotateY}deg) translateZ(${translateZ}px) translateX(${translateX}%) scale(${scale})`,
                    opacity,
                    transition: 'transform 0.5s ease, opacity 0.5s ease',
                    transformOrigin: isLeft ? 'right center' : isRight ? 'left center' : 'center center',
                    boxShadow: isSelected
                      ? '0 20px 40px -12px rgba(0, 0, 0, 0.35)'
                      : '0 8px 24px -5px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.label}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-5 text-white">
                    <h3 className="text-base sm:text-lg font-semibold">{item.label}</h3>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5 sm:mt-1">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-1.5 sm:gap-2 mt-1 sm:mt-2">
        {carouselData.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={`h-1.5 sm:h-2 rounded-full transition-all duration-200 ${
              index === selectedIndex
                ? 'w-6 sm:w-8 bg-primary'
                : 'w-1.5 sm:w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
