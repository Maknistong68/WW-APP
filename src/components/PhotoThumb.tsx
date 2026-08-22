import { useEffect, useState } from 'react'

/** Renders a Blob as an <img>, managing the object URL lifecycle. */
export default function PhotoThumb({
  blob,
  className,
  onClick,
  alt,
}: {
  blob: Blob
  className?: string
  onClick?: () => void
  alt?: string
}) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  if (!url) return null
  return <img src={url} className={className} onClick={onClick} alt={alt ?? 'photo'} />
}
