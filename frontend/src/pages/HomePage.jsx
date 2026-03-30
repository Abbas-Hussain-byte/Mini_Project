import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiShield, FiMapPin, FiBarChart2, FiZap, FiArrowRight, FiCamera, FiUsers } from 'react-icons/fi';
import backgroundImg from '../assets/img-1.avif';

export default function HomePage() {
  const { user } = useAuth();

  const features = [
    { icon: <FiCamera className="w-6 h-6" />, title: 'AI Hazard Detection', desc: 'YOLOv8 detects potholes, waterlogging, and safety hazards from uploaded images.' },
    { icon: <FiMapPin className="w-6 h-6" />, title: 'Geospatial Clustering', desc: 'DBSCAN clusters complaints into hotspots displayed on interactive heatmaps.' },
    { icon: <FiUsers className="w-6 h-6" />, title: 'Smart Department Routing', desc: 'AI automatically assigns complaints to the right city department.' },
    { icon: <FiBarChart2 className="w-6 h-6" />, title: 'Analytics Dashboard', desc: 'Real-time statistics, response times, and risk area indicators.' },
    { icon: <FiShield className="w-6 h-6" />, title: 'Severity Prediction', desc: 'Combines image and text analysis to estimate urgency and priority.' },
    { icon: <FiZap className="w-6 h-6" />, title: 'Budget Prioritization', desc: 'Optimizes complaint resolution under budget constraints.' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-animated overflow-hidden">
        <div className="absolute inset-0">
          <img src={backgroundImg} alt="Background" className="w-full h-full object-cover opacity-30" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-civic-dark"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-24 md:py-36">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center px-4 py-1.5 mb-6 rounded-full bg-civic-accent/10 border border-civic-accent/20">
              <FiZap className="w-4 h-4 text-civic-accent mr-2" />
              <span className="text-sm text-civic-accent font-medium">AI-Powered Civic Intelligence</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6">
              <span className="gradient-text">CivicPulse</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              An AI-assisted platform that empowers citizens to report urban issues 
              and helps authorities detect hazards, prioritize response, and build safer cities.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link to="/submit" className="group flex items-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold text-lg shadow-lg shadow-civic-accent/25 hover:shadow-civic-accent/40 transition-all">
                  Report an Issue <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <Link to="/register" className="group flex items-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold text-lg shadow-lg shadow-civic-accent/25 hover:shadow-civic-accent/40 transition-all">
                  Get Started <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
              <Link to="/heatmap" className="px-8 py-3.5 rounded-xl border border-civic-border text-slate-300 font-medium hover:bg-white/5 transition-all">
                View Heatmap
              </Link>
            </div>
          </div>

          {/* Floating stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: 'YOLOv8', label: 'Hazard Detection' },
              { value: 'BERT', label: 'Text Analysis' },
              { value: 'DBSCAN', label: 'Clustering' },
              { value: 'Real-time', label: 'Monitoring' },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-4 text-center animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <p className="text-xl font-bold text-civic-accent">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Intelligent Civic Platform</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Powered by computer vision, NLP, and geospatial AI to transform urban complaint management.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="glass-card p-6 hover:border-civic-accent/30 transition-all group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-civic-accent/10 flex items-center justify-center text-civic-accent mb-4 group-hover:bg-civic-accent/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-14">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Report', desc: 'Citizen uploads photo & location of the issue' },
            { step: '02', title: 'Analyze', desc: 'AI detects hazards, classifies severity, checks duplicates' },
            { step: '03', title: 'Route', desc: 'System auto-assigns to the right department with deadline' },
            { step: '04', title: 'Resolve', desc: 'Department tracks progress, citizen gets updates' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-civic-accent/20 to-primary-500/20 border border-civic-accent/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold gradient-text">{item.step}</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-civic-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">© 2026 CivicPulse — AI Civic Intelligence Platform. Built for smarter cities.</p>
        </div>
      </footer>
    </div>
  );
}
