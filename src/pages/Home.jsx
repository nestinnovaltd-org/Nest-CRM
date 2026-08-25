import React from 'react'

const Home = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      textAlign: 'center' 
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Faham-Estate Real Estate CRM</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
        Experience the Royal standard in Real Estate Management.
      </p>
      <div className="premium-card" style={{ padding: '2rem', marginTop: '2rem', maxWidth: '400px' }}>
        <h3 style={{ marginBottom: '1rem' }}>Premium Design</h3>
        <p>This is a preview of the "Royal" UI aesthetic. Clean, elegant, and high-end.</p>
        <button className="btn btn-primary btn-md" style={{ 
          marginTop: '1.5rem'
        }}>
          Explore Dashboard
        </button>
      </div>
    </div>
  )
}

export default Home
