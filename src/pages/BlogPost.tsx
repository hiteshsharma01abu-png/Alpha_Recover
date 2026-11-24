import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Markdown } from '../components/ui/Markdown';
import { blogPostSeo } from '../data/seo';
import { useBlogPost } from '../lib/blog';
import { applyPageMeta } from '../lib/pageMeta';
import './SimplePages.css';

export function BlogPost() {
  const { slug } = useParams();
  const { post, settled } = useBlogPost(slug);

  // Posts written in the admin panel aren't pre-rendered: once loaded, give them their own title and share card.
  useEffect(() => {
    if (post) applyPageMeta(blogPostSeo(post));
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
