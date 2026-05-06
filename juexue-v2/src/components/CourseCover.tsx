// 课程封面 · 优先 coverImageUrl(支持 -1024.webp srcset) · 否则自动生成设计封面
//   - 有 coverImageUrl · 走 <picture> 多尺寸 srcset
//   - 无 coverImageUrl · 渲染 标题 + emoji + 书脊 的设计版式（按 title hash 选色）
import type { Course } from '@/lib/queries';

// 6 套配色 · 按 title 字符 hash 选 · 同法本永远同色 · 列表里色相分散
const PALETTES = [
  { bg: 'linear-gradient(160deg, #F4D6B8 0%, #E8B98A 100%)', fg: '#5A3A1F', spine: '#C99563' },
  { bg: 'linear-gradient(160deg, #D9E5C8 0%, #B6C9A0 100%)', fg: '#3F4F2D', spine: '#8AA170' },
  { bg: 'linear-gradient(160deg, #E8D4D0 0%, #C99B92 100%)', fg: '#5A2D24', spine: '#A56F65' },
  { bg: 'linear-gradient(160deg, #D9DAE6 0%, #A8AAC4 100%)', fg: '#2E2F4A', spine: '#7A7C9C' },
  { bg: 'linear-gradient(160deg, #F1E0BD 0%, #DBBF85 100%)', fg: '#5A4220', spine: '#B5945C' },
  { bg: 'linear-gradient(160deg, #C9DDD9 0%, #8FB4AC 100%)', fg: '#1F3F3A', spine: '#5F8B82' },
];

function pickPalette(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

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
  /** 'cover' = 填满裁切（小缩略图）· 'contain' = 完整不裁切（详情页大封面）· 默认 cover */
  fit?: 'cover' | 'contain';
}

export default function CourseCover({
  course, width, height, emojiSize = '2.2rem', alt, className, style, fit = 'cover',
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
    // 自动生成设计封面 · 标题 emoji 同构 · 不依赖外部图片
    // 颜色 token 按 title 字符 hash 选 · 同一本法本永远同色
    const palette = pickPalette(course.title);
    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          background: palette.bg,
          flexDirection: 'column',
          // 顶部 padding 用 max(20%, 36px) · 保证 36px 给"已加入"徽章
          // (徽章 top:8 + 高度 22 + 6buf = 36px) · 标题不再被挡
          padding: 'max(20%, 36px) 12% 12%',
          position: 'relative',
          textAlign: 'center',
          // 用 container query 让标题字号跟着封面宽度线性放大
          // 详情页大封面用同一组件不会显得字小
          containerType: 'inline-size',
        }}
      >
        {/* 左侧书脊线 · 模拟装订 · 视觉提示"这是一本书" */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '4%',
            background: palette.spine,
          }}
        />
        {/* 标题 · 顶部居中 · 直排观感的横排兜底 */}
        <span
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 'clamp(.875rem, 14cqw, 1.5rem)',
            lineHeight: 1.25,
            letterSpacing: '2px',
            color: palette.fg,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {course.title}
        </span>
        {/* 装饰 emoji · 底部居中 */}
        <span
          aria-hidden
          style={{
            marginTop: 'auto',
            fontSize: emojiSize,
            lineHeight: 1,
            opacity: 0.85,
          }}
        >
          {course.coverEmoji}
        </span>
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
            style={{ width: '100%', height: '100%', objectFit: fit }}
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
