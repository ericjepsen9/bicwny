// 课程封面 · 优先 coverImageUrl(支持 -1024.webp srcset) · 否则渐变 + emoji
//   原版 prototypes/shared/components.js 的 coverHtml 函数 React 化
import type { Course } from '@/lib/queries';

interface Props {
  course: Pick<Course, 'coverImageUrl' | 'coverEmoji' | 'title'>;
  /** width × height in px · 默认 fill 父容器 */
  width?: number | string;
  height?: number | string;
  /** emoji 字号 · 默认 2.2rem */
  emojiSize?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function CourseCover({
  course, width, height, emojiSize = '2.2rem', alt, className, style,
}: Props) {
  const url = course.coverImageUrl;
  const containerStyle: React.CSSProperties = {
    width: width ?? '100%',
    height: height ?? '100%',
    aspectRatio: width || height ? undefined : '1 / 1',
    background: 'linear-gradient(135deg, var(--saffron-pale), var(--gold-pale))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  };

  if (!url) {
    return (
      <div className={className} style={containerStyle}>
        <span aria-hidden style={{ fontSize: emojiSize, lineHeight: 1 }}>{course.coverEmoji}</span>
      </div>
    );
  }

  // 检测多尺寸 webp（admin 上传时生成 -320 / -640 / -1024）
  // 命名约定：xxx-1024.webp · 对应同前缀的 -320 / -640
  const m = /^(.+)-1024\.webp$/.exec(url);
  if (m) {
    const base = m[1];
    return (
      <div className={className} style={containerStyle}>
        <picture>
          <source
            type="image/webp"
            srcSet={`${base}-320.webp 320w, ${base}-640.webp 640w, ${base}-1024.webp 1024w`}
            sizes="(max-width: 480px) 100vw, 480px"
          />
          <img
            src={url}
            alt={alt ?? course.title}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </picture>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <img
        src={url}
        alt={alt ?? course.title}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
