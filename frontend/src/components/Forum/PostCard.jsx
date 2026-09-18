export default function PostCard({ post, isOwn, onClick }) {
  const preview = post.content.length > 140 ? `${post.content.slice(0, 140)}...` : post.content;
  const date = new Date(post.createdAt).toLocaleDateString();

  return (
    <div className="post-card" onClick={onClick}>
      <div className="post-card-header">
        <h3>{post.title}</h3>
        {isOwn && post.status === 'pending' && (
          <span className="post-badge post-badge--pending">Under review</span>
        )}
      </div>
      <p className="post-card-preview">{preview}</p>
      <div className="post-card-meta">
        <span>{date}</span>
      </div>
    </div>
  );
}