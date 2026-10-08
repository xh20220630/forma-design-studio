import type { BrandVector } from '@forma/schema';

export default function BrandSymbol({
  vector,
  size = 160,
  reverse = false,
  label = '品牌标志',
}: {
  vector: BrandVector;
  size?: number;
  reverse?: boolean;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={(size * vector.height) / vector.width}
      viewBox={`0 0 ${vector.width} ${vector.height}`}
      role="img"
      aria-label={label}
    >
      {vector.paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={
            reverse ? (path.fill.toUpperCase() === '#FFFFFF' ? '#000000' : '#FFFFFF') : path.fill
          }
          fillRule={path.fillRule}
        />
      ))}
    </svg>
  );
}
