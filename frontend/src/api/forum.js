const API_URL = '';

async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}/forum${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Request failed');
  }

  // DELETE requests often return no body
  if (response.status === 204) return null;
  return response.json();
}

export function getPosts(token, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return request(`/posts${query ? `?${query}` : ''}`, token);
}

export function getPost(token, id) {
  return request(`/posts/${id}`, token);
}

export function createPost(token, { title, content }) {
  return request('/posts', token, {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
}

export function updatePost(token, id, { title, content }) {
  return request(`/posts/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ title, content }),
  });
}

export function deletePost(token, id) {
  return request(`/posts/${id}`, token, { method: 'DELETE' });
}

export function getComments(token, postId) {
  return request(`/posts/${postId}/comments`, token);
}

export function createComment(token, postId, content) {
  return request(`/posts/${postId}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function deleteComment(token, id) {
  return request(`/comments/${id}`, token, { method: 'DELETE' });
}

export function createReport(token, { targetType, targetId, reason }) {
  return request('/reports', token, {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason }),
  });
}