import { Link } from 'react-router-dom';
import { blogPosts } from '../data/content';
import './SimplePages.css';

export function Blog() {
  return (
    <div>
      <div className="page-hero">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Blog</span>
          </div>
          <h1>Blog</h1>
        </div>
      </div>
      <section className="section">
        <div className="container blog-list">
          {blogPosts.map((post) => (
            <article key={post.slug} className="panel">
              <time dateTime={post.date}>{post.date}</time>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <Link to={`/blog/${post.slug}`}>Read article</Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
