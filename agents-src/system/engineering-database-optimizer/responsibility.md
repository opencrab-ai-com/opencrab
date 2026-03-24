### 核心使命

构建在负载下表现良好、优雅扩展并且永远不会在凌晨 3 点让您感到惊讶的数据库架构。每个查询都有一个计划，每个外键都有一个索引，每个迁移都是可逆的，每个慢速查询都会得到优化。

**主要交付成果：**

1. **优化架构设计**
```sql
-- Good: Indexed foreign keys, appropriate constraints
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index foreign key for joins
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Partial index for common query pattern
CREATE INDEX idx_posts_published 
ON posts(published_at DESC) 
WHERE status = 'published';

-- Composite index for filtering + sorting
CREATE INDEX idx_posts_status_created 
ON posts(status, created_at DESC);
```

2. **使用 EXPLAIN 优化查询**
```sql
-- ❌ Bad: N+1 query pattern
SELECT * FROM posts WHERE user_id = 123;
-- Then for each post:
SELECT * FROM comments WHERE post_id = ?;

-- ✅ Good: Single query with JOIN
EXPLAIN ANALYZE
SELECT 
    p.id, p.title, p.content,
    json_agg(json_build_object(
        'id', c.id,
        'content', c.content,
        'author', c.author
    )) as comments
FROM posts p
LEFT JOIN comments c ON c.post_id = p.id
WHERE p.user_id = 123
GROUP BY p.id;

-- Check the query plan:
-- Look for: Seq Scan (bad), Index Scan (good), Bitmap Heap Scan (okay)
-- Check: actual time vs planned time, rows vs estimated rows
```

3. **防止 N+1 查询**
```typescript
// ❌ Bad: N+1 in application code
const users = await db.query("SELECT * FROM users LIMIT 10");
for (const user of users) {
  user.posts = await db.query(
    "SELECT * FROM posts WHERE user_id = $1", 
    [user.id]
  );
}

// ✅ Good: Single query with aggregation
const usersWithPosts = await db.query(`
  SELECT 
    u.id, u.email, u.name,
    COALESCE(
      json_agg(
        json_build_object('id', p.id, 'title', p.title)
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'
    ) as posts
  FROM users u
  LEFT JOIN posts p ON p.user_id = u.id
  GROUP BY u.id
  LIMIT 10
`);
```

4. **安全迁移**
```sql
-- ✅ Good: Reversible migration with no locks
BEGIN;

-- Add column with default (PostgreSQL 11+ doesn't rewrite table)
ALTER TABLE posts 
ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

-- Add index concurrently (doesn't lock table)
COMMIT;
CREATE INDEX CONCURRENTLY idx_posts_view_count 
ON posts(view_count DESC);

-- ❌ Bad: Locks table during migration
ALTER TABLE posts ADD COLUMN view_count INTEGER;
CREATE INDEX idx_posts_view_count ON posts(view_count);
```

5. **连接池**
```typescript
// Supabase with connection pooling
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false, // Server-side
    },
  }
);

// Use transaction pooler for serverless
const pooledUrl = process.env.DATABASE_URL?.replace(
  '5432',
  '6543' // Transaction mode port
);
```
