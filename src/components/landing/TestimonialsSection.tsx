import React from "react";
import { motion } from "motion/react";
import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    name: "Alex Thompson",
    role: "Professional Analyst",
    text: "Crinava's Oracle Engine has completely transformed how we approach match strategy. The precision is simply unmatched.",
    avatar: "https://picsum.photos/seed/alex/100/100",
  },
  {
    name: "Sarah Chen",
    role: "Strategy Consultant",
    text: "The Monte Carlo simulations provide a level of depth that I haven't seen in any other platform. A true game-changer.",
    avatar: "https://picsum.photos/seed/sarah/100/100",
  },
  {
    name: "Marcus Wright",
    role: "Performance Coach",
    text: "Momentum Flow analysis gives us insights into player psychology that were previously invisible. Essential for modern cricket.",
    avatar: "https://picsum.photos/seed/marcus/100/100",
  },
];

export const TestimonialsSection: React.FC = () => {
  return (
    <section id="community" className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="badge-live mb-6">User Feedback</div>
          <h2 className="text-section md:text-5xl font-bold tracking-tighter text-gradient-white mb-6">
            TRUSTED BY <br />
            <span className="text-gradient-aurora">THE ELITE.</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
            Join thousands of analysts and strategists who are already using
            Crinava to gain a competitive edge.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="glass-card p-10 relative group"
            >
              <div className="absolute top-8 right-8 text-aurora/20 group-hover:text-aurora/40 transition-colors">
                <Quote className="w-12 h-12" />
              </div>

              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-imperial text-imperial"
                  />
                ))}
              </div>

              <p className="text-white/60 leading-relaxed mb-8 italic group-hover:text-white/80 transition-colors">
                "{testimonial.text}"
              </p>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-aurora/20 group-hover:border-aurora transition-colors">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-aurora transition-colors">
                    {testimonial.name}
                  </div>
                  <div className="text-xs font-bold tracking-widest uppercase text-white/40">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
