import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Calendar, ArrowRight } from "lucide-react";

export const BlogArchive = () => {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blogs")
      .then(res => res.json())
      .then(data => {
        setBlogs(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load blogs", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-void pt-32 pb-24 text-white font-space">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h1 className="text-5xl font-black mb-4">Crinava <span className="text-aurora-teal">Intel</span></h1>
          <p className="text-mercury/60 max-w-2xl text-lg">Deep tactical analysis, predictive trends, and AI-driven match breakdowns.</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aurora-teal"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogs.map((blog, i) => (
              <motion.div
                key={blog.id || i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link
                  to={`/blog/${blog.slug}`}
                  className="group block bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden hover:border-aurora-teal/50 transition-all hover:-translate-y-2 h-full"
                >
                  <div className="p-6 h-full flex flex-col">
                    <div className="flex items-center space-x-4 text-xs text-mercury/50 mb-4 font-mono">
                      <span className="flex items-center"><Calendar size={14} className="mr-1" /> {new Date(blog.created_at || blog.date).toLocaleDateString()}</span>
                      <span className="flex items-center"><Clock size={14} className="mr-1" /> {blog.read_time || blog.readTime}</span>
                    </div>
                    <span className="inline-block text-xs font-bold text-metallic-gold uppercase tracking-wider mb-2">
                      {blog.category}
                    </span>
                    <h3 className="text-xl font-bold mb-4 group-hover:text-aurora-teal transition-colors">
                      {blog.title}
                    </h3>
                    <p className="text-mercury/60 text-sm line-clamp-3 mb-6 flex-1">
                      {blog.content.replace(/[#*`>]/g, "").substring(0, 150)}...
                    </p>
                    <div className="flex items-center text-sm font-bold text-white group-hover:text-aurora-teal">
                      Read Full Intel <ArrowRight size={16} className="ml-2 group-hover:translate-x-2 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {blogs.length === 0 && (
              <div className="col-span-full text-center text-mercury/40 py-12">
                No articles published yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
