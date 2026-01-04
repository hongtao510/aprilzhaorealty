"use client";

import { useState } from "react";
import { Comment } from "@/lib/types";

const mockComments: Comment[] = [
  {
    id: "1",
    listingId: "4",
    author: "Sarah M.",
    content: "April was incredibly helpful throughout the entire process. The home sold quickly and above asking price!",
    createdAt: "2024-10-15",
  },
  {
    id: "2",
    listingId: "3",
    author: "Michael T.",
    content: "Great experience working with April on this purchase. She really knows the local market.",
    createdAt: "2024-11-20",
  },
];

export function CommentSection({ listingId }: { listingId: string }) {
  const [comments, setComments] = useState<Comment[]>(
    mockComments.filter((c) => c.listingId === listingId)
  );
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;

    setIsSubmitting(true);

    const newComment: Comment = {
      id: Date.now().toString(),
      listingId,
      author: name,
      content,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setComments([...comments, newComment]);
    setName("");
    setContent("");
    setIsSubmitting(false);
  };

  return (
    <div className="pt-12 border-t border-zinc-100">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <span className="w-3 h-3 bg-[#86efac] rounded-full" />
        Feedback & Comments
      </h2>

      {/* Comment list */}
      {comments.length > 0 ? (
        <div className="space-y-4 mb-8">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-6 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#86efac] to-[#0d9488] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {comment.author.charAt(0)}
                  </div>
                  <p className="font-semibold">{comment.author}</p>
                </div>
                <p className="text-xs text-zinc-400">{comment.createdAt}</p>
              </div>
              <p className="text-zinc-600 leading-relaxed">{comment.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-zinc-50 rounded-2xl mb-8">
          <p className="text-zinc-500">No comments yet. Be the first to share your feedback!</p>
        </div>
      )}

      {/* Comment form */}
      <div className="bg-white border-2 border-zinc-100 rounded-2xl p-6">
        <h3 className="font-bold text-lg mb-4">Leave a Comment</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl focus:outline-none focus:border-[#86efac] transition-colors"
              placeholder="Jane Doe"
              required
            />
          </div>
          <div>
            <label htmlFor="comment" className="block text-sm font-semibold mb-2">
              Comment
            </label>
            <textarea
              id="comment"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl focus:outline-none focus:border-[#86efac] transition-colors resize-none"
              placeholder="Share your experience or feedback..."
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-[#166534] text-white font-semibold rounded-xl hover:bg-[#14532d] transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            {isSubmitting ? "Posting..." : "Post Comment"}
          </button>
        </form>
      </div>
    </div>
  );
}
