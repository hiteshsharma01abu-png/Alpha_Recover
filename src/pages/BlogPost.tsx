import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Markdown } from '../components/ui/Markdown';
import { useBlogPost } from '../lib/blog';
import './SimplePages.css';

export function BlogPost() {
  const { slug } = useParams();
  const { post, settled } = useBlogPost(slug);

  useEffect(() => {
    if (!post) return;
    const previous = document.title;
    document.title = `${post.seoTitle || post.title} | Alpha Recover`;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    if (meta) meta.content = post.seoDescription || post.excerpt;
    return () => {
      document.title = previous;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [post]);

  if (!post && !settled) return <div className="section container" aria-busy="true" />;

  if (!post) {
    return (
      <div className="section container">
        <h1>Post not found</h1>
        <Link to="/blog">Back to blog</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/blog">Blog</Link>
            <span>/</span>
            <span>{post.title}</span>
          </div>
          <h1>{post.title}</h1>
        </div>
      </div>
      <section className="section">
        <div className="container prose">
          <time dateTime={post.date}>{post.date}</time>
          <Markdown source={post.bodyMarkdown} />
          <Link to="/blog">All posts</Link>
        </div>
      </section>
    </div>
  );
}
