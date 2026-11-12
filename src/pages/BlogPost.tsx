import { Link, useParams } from 'react-router-dom';
import { blogPosts } from '../data/content';
import './SimplePages.css';

export function BlogPost() {
  const { slug } = useParams();
  const post = blogPosts.find((p) => p.slug === slug);

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
          <p>{post.excerpt}</p>
          <p>
            Full CMS content will load from your database once blogging is wired. For now this
            page proves the route and layout for article reading.
          </p>
          <Link to="/blog">All posts</Link>
        </div>
      </section>
    </div>
  );
}
