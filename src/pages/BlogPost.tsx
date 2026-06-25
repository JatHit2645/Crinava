import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { Clock, Calendar, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";

const highlightQuotesInChildren = (children: React.ReactNode): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      // Matches both regular "..." and curly “...” quotes, excluding multi-line matches
      const parts = child.split(/(["“][^"”\n]+["”])/g);
      return parts.map((part, idx) => {
        if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith('“') && part.endsWith('”'))) {
          return (
            <span 
              key={idx} 
              className="bg-gradient-to-r from-aurora-teal/10 to-metallic-gold/15 text-white italic px-1.5 py-0.5 rounded border border-white/5 font-semibold text-base inline-block"
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }
    return child;
  });
};

export const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    fetch(`/api/blogs/${slug}`)
      .then(res => res.json())
      .then(data => {
        setBlog(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load blog", err);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-aurora-teal"></div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen bg-void flex flex-col justify-center items-center text-white">
        <h1 className="text-4xl font-bold mb-4">Intel Not Found</h1>
        <button onClick={() => navigate("/blog")} className="text-aurora-teal hover:underline flex items-center">
          <ArrowLeft size={16} className="mr-2" /> Return to Archives
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void text-white font-space relative selection:bg-aurora-teal selection:text-black">
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-aurora-teal to-metallic-gold z-50 origin-left"
        style={{ scaleX }}
      />
      
      <div className="pt-32 pb-24">
        <div className="container mx-auto px-4 max-w-3xl">
          <button 
            onClick={() => navigate("/blog")}
            className="flex items-center text-sm font-bold text-mercury/50 hover:text-white transition-colors mb-12 uppercase tracking-widest"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to Archives
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center space-x-3 mb-6">
              <span className="text-xs font-bold bg-white/5 text-aurora-teal px-3 py-1 rounded-full border border-aurora-teal/20 uppercase tracking-widest">
                {blog.category}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-8 leading-tight font-display">
              {blog.title}
            </h1>

            <div className="flex items-center space-x-6 text-sm text-mercury/40 font-mono mb-16 pb-8 border-b border-white/10">
              <span className="flex items-center"><Calendar size={16} className="mr-2" /> {new Date(blog.created_at || blog.date).toLocaleDateString()}</span>
              <span className="flex items-center"><Clock size={16} className="mr-2" /> {blog.read_time || blog.readTime}</span>
            </div>

            <div className="max-w-none text-mercury/80 leading-relaxed text-lg pb-12">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-4xl font-display font-black text-white mt-12 mb-6 tracking-tight" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-3xl font-display font-bold text-metallic-gold mt-10 mb-5 tracking-tight border-b border-white/10 pb-2" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-2xl font-bold text-white mt-8 mb-4" {...props} />,
                  h4: ({node, ...props}) => <h4 className="text-xl font-bold text-aurora-teal mt-6 mb-3" {...props} />,
                  p: ({node, ...props}) => <p className="mb-6 leading-relaxed">{highlightQuotesInChildren(props.children)}</p>,
                  ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-6 space-y-2 marker:text-aurora-teal" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-6 space-y-2 marker:text-metallic-gold" {...props} />,
                  li: ({node, ...props}) => <li className="pl-2" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-metallic-gold bg-white/[0.02] py-4 px-6 rounded-r-lg my-8 italic text-white/90" {...props} />,
                  code: ({node, inline, ...props}: any) => 
                    inline ? 
                      <code className="bg-white/10 text-metallic-gold px-1.5 py-0.5 rounded text-sm font-mono" {...props} /> : 
                      <code className="block bg-[#0a0a0a] border border-white/10 p-4 rounded-lg text-sm font-mono overflow-x-auto my-6 text-aurora-teal" {...props} />,
                  a: ({node, ...props}) => <a className="text-aurora-teal hover:text-metallic-gold underline decoration-white/20 underline-offset-4 transition-colors" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />
                }}
              >
                {blog.content}
              </ReactMarkdown>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
