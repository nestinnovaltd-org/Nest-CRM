import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Globe, Building2, Mail, Phone, User, MessageSquare, Sparkles, Shield, Zap, BarChart3 } from 'lucide-react';
import './BookDemo.css';

export default function BookDemo() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company_name: '',
    custom_domain_requested: '', message: '', plan_interest: 'professional',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.company_name) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.from('book_demo_leads').insert({
      ...form,
      status: 'new',
      created_at: new Date().toISOString(),
    });
    if (err) { setError('Submission failed. Please try again.'); setLoading(false); return; }
    setSubmitted(true);
    setLoading(false);
  };

  const features = [
    { icon: Zap, title: 'Custom Domain', desc: 'Your own branded CRM at yourcompany.nestcrm.com' },
    { icon: Shield, title: 'Full Data Control', desc: 'Your organization data, completely isolated and secure' },
    { icon: BarChart3, title: 'Advanced Analytics', desc: 'Team performance, lead conversion, revenue reports' },
    { icon: Sparkles, title: 'All Modules', desc: 'HR, Payments, Projects, Calendar — everything included' },
  ];

  return (
    <div className="bd-page">
      {/* Header */}
      <nav className="bd-nav">
        <Link to="/" className="bd-logo">
          <img src="/logo.png" alt="Nest CRM" className="bd-logo-img" />
          <span className="bd-logo-text">Nest CRM</span>
        </Link>
        <div className="bd-nav-links">
          <Link to="/login" className="bd-nav-link">Login</Link>
          <Link to="/" className="bd-nav-btn">← Back to Home</Link>
        </div>
      </nav>

      <div className="bd-container">
        {/* Left side */}
        <div className="bd-left">
          <div className="bd-eyebrow">
            <Globe size={14} />
            Custom Domain Access
          </div>
          <h1 className="bd-title">
            Get Your Own
            <span className="bd-title-gradient"> Branded CRM</span>
          </h1>
          <p className="bd-subtitle">
            Book a personalized demo and see how Nest CRM can transform your organization's real estate operations — on your own custom domain.
          </p>

          <div className="bd-features">
            {features.map(f => (
              <div key={f.title} className="bd-feature">
                <div className="bd-feature-icon">
                  <f.icon size={18} />
                </div>
                <div>
                  <div className="bd-feature-title">{f.title}</div>
                  <div className="bd-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bd-packages">
            <div className="bd-pkg-label">Available Plans</div>
            <div className="bd-pkg-list">
              {[
                { name: 'Starter', price: '$49', users: '10 users', color: '#10B981' },
                { name: 'Professional', price: '$99', users: '25 users', color: '#3B82F6', popular: true },
                { name: 'Enterprise', price: '$199', users: 'Unlimited', color: '#F59E0B' },
              ].map(p => (
                <div key={p.name} className={`bd-pkg-card ${p.popular ? 'popular' : ''}`} style={{ borderColor: p.popular ? p.color : '' }}>
                  {p.popular && <span className="bd-pkg-popular" style={{ background: p.color }}>Most Popular</span>}
                  <span className="bd-pkg-name" style={{ color: p.color }}>{p.name}</span>
                  <span className="bd-pkg-price">{p.price}<span>/mo</span></span>
                  <span className="bd-pkg-users">{p.users}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side — form */}
        <div className="bd-right">
          {submitted ? (
            <div className="bd-success">
              <div className="bd-success-icon">
                <CheckCircle size={48} color="#10B981" />
              </div>
              <h2>Request Submitted!</h2>
              <p>We've received your demo request. Our team will contact you within <strong>24 hours</strong> to schedule your personalized demo.</p>
              <div className="bd-success-info">
                <div>Company: <strong>{form.company_name}</strong></div>
                <div>Domain: <strong>{form.custom_domain_requested || 'Not specified'}</strong></div>
                <div>Email: <strong>{form.email}</strong></div>
              </div>
              <Link to="/" className="bd-btn-primary">← Back to Home</Link>
            </div>
          ) : (
            <form className="bd-form" onSubmit={handleSubmit}>
              <div className="bd-form-header">
                <h2>Book Your Demo</h2>
                <p>Fill in your details and we'll get back to you within 24 hours</p>
              </div>

              <div className="bd-form-grid">
                <div className="bd-field">
                  <label><User size={13} /> Full Name <span className="bd-required">*</span></label>
                  <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Mohammad Sajjad Khan" required />
                </div>
                <div className="bd-field">
                  <label><Mail size={13} /> Email Address <span className="bd-required">*</span></label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" required />
                </div>
                <div className="bd-field">
                  <label><Phone size={13} /> Phone Number</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+880 1XXX XXXXXX" />
                </div>
                <div className="bd-field">
                  <label><Building2 size={13} /> Company Name <span className="bd-required">*</span></label>
                  <input name="company_name" value={form.company_name} onChange={handleChange} placeholder="Your Real Estate Company" required />
                </div>
                <div className="bd-field bd-field-full">
                  <label><Globe size={13} /> Desired Custom Domain</label>
                  <div className="bd-domain-input">
                    <input name="custom_domain_requested" value={form.custom_domain_requested} onChange={handleChange} placeholder="yourcompany" />
                    <span className="bd-domain-suffix">.nestcrm.com</span>
                  </div>
                </div>
                <div className="bd-field bd-field-full">
                  <label>Interested Plan</label>
                  <div className="bd-plan-options">
                    {[
                      { id: 'starter', label: 'Starter', price: '$49/mo', color: '#10B981' },
                      { id: 'professional', label: 'Professional', price: '$99/mo', color: '#3B82F6' },
                      { id: 'enterprise', label: 'Enterprise', price: '$199/mo', color: '#F59E0B' },
                    ].map(p => (
                      <label key={p.id} className={`bd-plan-opt ${form.plan_interest === p.id ? 'selected' : ''}`}
                        style={{ borderColor: form.plan_interest === p.id ? p.color : '', background: form.plan_interest === p.id ? `${p.color}15` : '' }}>
                        <input type="radio" name="plan_interest" value={p.id} checked={form.plan_interest === p.id} onChange={handleChange} style={{ display: 'none' }} />
                        <span className="bd-plan-name" style={{ color: form.plan_interest === p.id ? p.color : '' }}>{p.label}</span>
                        <span className="bd-plan-price">{p.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="bd-field bd-field-full">
                  <label><MessageSquare size={13} /> Message / Requirements</label>
                  <textarea name="message" value={form.message} onChange={handleChange} rows={4} placeholder="Tell us about your team size, specific requirements, or questions..." />
                </div>
              </div>

              {error && <div className="bd-error">{error}</div>}

              <button type="submit" className="bd-submit" disabled={loading}>
                {loading ? 'Submitting...' : (<>Book Demo Now <ArrowRight size={16} /></>)}
              </button>

              <p className="bd-disclaimer">
                By submitting, you agree to be contacted by the Nest CRM team. No spam, ever.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
