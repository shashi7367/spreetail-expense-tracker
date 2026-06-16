import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { BarChart3, TrendingUp, Sparkles, AlertCircle, Info, Loader2 } from 'lucide-react';

const CATEGORY_MAP = {
  'FOOD': { label: 'Food & Dining', color: '#8b5cf6', hoverColor: '#a78bfa' }, // Violet
  'TRAVEL': { label: 'Travel & Transport', color: '#10b981', hoverColor: '#34d399' }, // Emerald
  'STAY': { label: 'Accommodation', color: '#06b6d4', hoverColor: '#22d3ee' }, // Cyan
  'ENTERTAINMENT': { label: 'Entertainment', color: '#ec4899', hoverColor: '#f472b6' }, // Pink
  'UTILITIES': { color: '#f97316', label: 'Utilities', hoverColor: '#fb923c' }, // Orange
  'OTHER': { label: 'Other', color: '#64748b', hoverColor: '#94a3b8' } // Slate
};

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [sumRes, predRes] = await Promise.all([
          api.get('/api/analytics/summary/'),
          api.get('/api/analytics/predict/')
        ]);
        setData(sumRes.data);
        setPredictions(predRes.data);
      } catch (err) {
        toast.error("Failed to load analytics dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-2" />
        <p className="text-sm text-slate-400 font-medium">Analyzing transaction ledgers...</p>
      </div>
    );
  }

  // Calculate variables for Category Doughnut Chart
  const categorySpend = data?.category_spend || {};
  const totalSpend = Object.values(categorySpend).reduce((acc, v) => acc + v, 0);
  
  // Format category spend for rendering
  const categorySegments = Object.entries(categorySpend).map(([cat, amount]) => {
    const config = CATEGORY_MAP[cat] || CATEGORY_MAP['OTHER'];
    return {
      category: cat,
      label: config.label,
      amount,
      percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
      color: config.color,
      hoverColor: config.hoverColor
    };
  }).sort((a, b) => b.amount - a.amount);

  // Generate SVG segments for Doughnut Chart
  let accumulatedPercent = 0;
  const doughnutSegments = categorySegments.map((seg, idx) => {
    const startPercent = accumulatedPercent;
    accumulatedPercent += seg.percentage;
    
    // Draw SVG arc representing the slice
    const angle1 = (startPercent / 100) * 360 - 90;
    const angle2 = (accumulatedPercent / 100) * 360 - 90;
    
    const rad1 = (angle1 * Math.PI) / 180;
    const rad2 = (angle2 * Math.PI) / 180;
    
    const r = 70; // Radius
    const cx = 100;
    const cy = 100;
    
    const x1 = cx + r * Math.cos(rad1);
    const y1 = cy + r * Math.sin(rad1);
    const x2 = cx + r * Math.cos(rad2);
    const y2 = cy + r * Math.sin(rad2);
    
    const largeArcFlag = seg.percentage > 50 ? 1 : 0;
    
    // SVG path string
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    
    return {
      ...seg,
      d,
      index: idx
    };
  });

  // Trend line chart configurations
  const monthlyTrend = data?.monthly_trend || [];
  const maxMonthlySpend = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map(m => m.amount)) : 0;
  
  // Create coordinate points for area chart
  const padding = 40;
  const width = 500;
  const height = 200;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  let trendPath = "";
  let areaPath = "";
  const trendPoints = [];

  if (monthlyTrend.length > 0) {
    monthlyTrend.forEach((m, idx) => {
      const x = padding + (idx / Math.max(1, monthlyTrend.length - 1)) * chartWidth;
      const y = padding + chartHeight - (maxMonthlySpend > 0 ? (m.amount / maxMonthlySpend) * chartHeight : 0);
      trendPoints.push({ x, y, label: m.month, amount: m.amount });
    });

    if (trendPoints.length === 1) {
      trendPoints.push({ ...trendPoints[0], x: padding + chartWidth });
    }

    trendPath = `M ${trendPoints[0].x} ${trendPoints[0].y} ` + trendPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    areaPath = `${trendPath} L ${trendPoints[trendPoints.length - 1].x} ${padding + chartHeight} L ${trendPoints[0].x} ${padding + chartHeight} Z`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-violet-500" />
            Financial Analytics
          </h1>
          <p className="text-slate-400 mt-1">Deep analysis of spending patterns, visual charts, and forecasting insights.</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-2 text-violet-400 shadow-lg shrink-0">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide uppercase">AI Powered Recommendations</span>
        </div>
      </div>

      {totalSpend === 0 ? (
        <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">No expense logs to analyze</h3>
          <p className="text-slate-400 mt-2 max-w-sm mx-auto">Create and split some transactions inside your groups, or upload a receipt to generate analytical reports.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Breakdown (Doughnut Chart) */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 rounded-xl p-6 shadow-xl lg:col-span-2 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Spend by Category</h2>
              <p className="text-xs text-slate-400 mb-6">Percentage distribution of your expenditures across all categories.</p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8 justify-around">
              {/* SVG Doughnut */}
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                  {/* Outer circle for hover effect */}
                  {doughnutSegments.map((seg, idx) => (
                    <path
                      key={seg.category}
                      d={seg.d}
                      fill={activeCategory === idx ? seg.hoverColor : seg.color}
                      className="cursor-pointer transition-all duration-200 hover:scale-105 origin-center"
                      onMouseEnter={() => setActiveCategory(idx)}
                      onMouseLeave={() => setActiveCategory(null)}
                      style={{ transformBox: 'fill-box' }}
                    />
                  ))}
                  {/* Central cutout circle for doughnut */}
                  <circle cx="100" cy="100" r="45" fill="#0f172a" />
                </svg>
                {/* Center text indicating total spend */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  {activeCategory !== null ? (
                    <>
                      <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">
                        {categorySegments[activeCategory].label}
                      </span>
                      <span className="text-base font-extrabold text-violet-300">
                        ₹{categorySegments[activeCategory].amount.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {categorySegments[activeCategory].percentage.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Total spent</span>
                      <span className="text-lg font-black text-white">₹{totalSpend.toFixed(0)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Legends Table */}
              <div className="flex-1 w-full max-w-sm flex flex-col gap-2.5">
                {categorySegments.map((seg, idx) => (
                  <div
                    key={seg.category}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors border ${
                      activeCategory === idx
                        ? 'bg-slate-850/60 border-slate-700/60'
                        : 'bg-transparent border-transparent'
                    }`}
                    onMouseEnter={() => setActiveCategory(idx)}
                    onMouseLeave={() => setActiveCategory(null)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-xs font-semibold text-slate-200">{seg.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white block">₹{seg.amount.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-500 block font-medium">{seg.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Expense Prediction Forecasting panel */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 rounded-xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-violet-400 mb-1">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-lg font-bold text-white">AI Predictor</h2>
              </div>
              <p className="text-xs text-slate-400">Smart forecasting models tracking historical expenditure records.</p>
              
              <div className="mt-6 border border-slate-800 bg-slate-900/80 rounded-xl p-4 flex items-center justify-between shadow-inner">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Predicted Next Month</p>
                  <p className="text-2xl font-black text-white mt-1">
                    ₹{predictions?.predicted_next_month?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-violet-650/15 flex items-center justify-center text-violet-400 border border-violet-900/40">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Smart Tips Recommendations */}
            <div className="mt-6 flex-1 flex flex-col justify-end">
              <h4 className="text-xs font-bold text-slate-350 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <Info className="w-3.5 h-3.5 text-violet-400" />
                Budget Recommendations
              </h4>
              <div className="flex flex-col gap-2.5">
                {predictions?.recommendations?.map((rec, i) => (
                  <div key={i} className="flex gap-2 p-2 bg-slate-950/45 border border-slate-850 rounded-lg text-xxs text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                    <p dangerouslySetInnerHTML={{ __html: rec }} className="leading-relaxed" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Spending Trends Line Chart */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 rounded-xl p-6 shadow-xl lg:col-span-3">
            <h2 className="text-lg font-bold text-white mb-1">Spending Trend</h2>
            <p className="text-xs text-slate-400 mb-6">Historical expenditure trajectory aggregated monthly.</p>
            
            {monthlyTrend.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">Data insufficient to plot trajectory.</p>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px]">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((val, i) => {
                    const y = padding + val * chartHeight;
                    const amountLabel = maxMonthlySpend - val * maxMonthlySpend;
                    return (
                      <g key={i}>
                        <line
                          x1={padding}
                          y1={y}
                          x2={width - padding}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={padding - 8}
                          y={y + 3}
                          fill="#64748b"
                          className="text-[9px] font-semibold text-right"
                          textAnchor="end"
                        >
                          ₹{amountLabel.toFixed(0)}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Gradients */}
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Shaded Area */}
                  {areaPath && (
                    <path d={areaPath} fill="url(#trendGrad)" />
                  )}

                  {/* Trend Line */}
                  {trendPath && (
                    <path
                      d={trendPath}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Points / Circles */}
                  {trendPoints.map((pt, i) => (
                    <g key={i} className="group cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="4"
                        fill="#818cf8"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="transition-all duration-200 group-hover:r-5 group-hover:fill-violet-450"
                      />
                      {/* Tooltip labels */}
                      <text
                        x={pt.x}
                        y={pt.y - 10}
                        fill="#cbd5e1"
                        className="text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity text-center"
                        textAnchor="middle"
                      >
                        ₹{pt.amount.toFixed(0)}
                      </text>
                      <text
                        x={pt.x}
                        y={padding + chartHeight + 14}
                        fill="#64748b"
                        className="text-[9px] font-bold"
                        textAnchor="middle"
                      >
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
