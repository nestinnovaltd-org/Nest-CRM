import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, Save, Printer, Building, User, Percent, Calculator } from 'lucide-react';
import './CreateDeal.css';

const CreateDeal = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [lead, setLead] = useState(null);
  const [rawProjectsList, setRawProjectsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [dealData, setDealData] = useState({
    projectId: '',
    unitNo: '',
    floorSize: '',
    pricePerSqft: '',
    value: '',
    downPaymentPercent: '20',
    downPaymentAmount: '',
    downPaymentDate: new Date().toISOString().split('T')[0],
    incentiveThresholdPercent: '30',
    numberOfInstallments: '',
    installmentStartDate: new Date().toISOString().split('T')[0]
  });

  const [incentiveSetup, setIncentiveSetup] = useState({
    commissionRate: '1',
    totalCommission: 0,
    agentCommission: 0,
    teamPool: 0
  });

  const [teamShares, setTeamShares] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const leadDoc = await getDoc(doc(db, 'leads', leadId));
        if (leadDoc.exists()) setLead({ id: leadDoc.id, ...leadDoc.data() });
        
        const projSnap = await getDocs(collection(db, 'projects'));
        setRawProjectsList(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const userSnap = await getDocs(collection(db, 'users'));
        setUsersList(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const teamsSnap = await getDocs(collection(db, 'teams'));
        setTeams(teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [leadId]);

  const projectsList = React.useMemo(() => {
    const isAdmin = user?.role === 'Admin' || user?.role === 'MD' || user?.role === 'System Admin';
    if (isAdmin) return rawProjectsList;

    const userName = user?.fullName || user?.name || '';
    const userTeams = teams.filter(team => 
      (team.members && team.members.includes(userName)) || 
      (team.teamLeads && team.teamLeads.includes(userName)) || 
      team.teamLead === userName
    );

    if (userTeams.length > 0) {
      const assignedProjects = [];
      userTeams.forEach(t => {
        if (t.assignedProjects) {
          assignedProjects.push(...t.assignedProjects);
        }
      });
      return rawProjectsList.filter(p => assignedProjects.includes(p.projectName));
    }

    return rawProjectsList;
  }, [rawProjectsList, user, teams]);

  useEffect(() => {
    const size = parseFloat(dealData.floorSize || 0);
    const price = parseFloat(dealData.pricePerSqft || 0);
    if (size > 0 && price > 0) {
      setDealData(prev => ({ ...prev, value: (size * price).toString() }));
    }
  }, [dealData.floorSize, dealData.pricePerSqft]);

  useEffect(() => {
    const val = parseFloat(dealData.value || 0);
    const pct = parseFloat(dealData.downPaymentPercent || 0);
    if (val && pct) {
      setDealData(prev => ({
        ...prev,
        downPaymentAmount: Math.round((val * pct) / 100).toString()
      }));
    }
  }, [dealData.value, dealData.downPaymentPercent]);

  useEffect(() => {
    const val = parseFloat(dealData.value || 0);
    const rate = parseFloat(incentiveSetup.commissionRate || 0);
    const totalCom = Math.round(val * (rate / 100));
    setIncentiveSetup(prev => ({
      ...prev,
      totalCommission: totalCom,
      agentCommission: Math.round(totalCom * 0.6),
      teamPool: Math.round(totalCom * 0.4)
    }));
  }, [dealData.value, incentiveSetup.commissionRate]);

  const generateInstallments = () => {
    const total = parseFloat(dealData.value || 0);
    const downPayment = parseFloat(dealData.downPaymentAmount || 0);
    const numInstallments = parseInt(dealData.numberOfInstallments || 0);
    const startDate = dealData.installmentStartDate;

    if (!total || numInstallments <= 0 || !startDate) return [];

    const remaining = total - downPayment;
    if (remaining <= 0) return [];
    
    const perInstallment = Math.round(remaining / numInstallments);
    let currentDue = remaining;
    
    const installments = [];
    const start = new Date(startDate);
    
    for (let i = 1; i <= numInstallments; i++) {
      currentDue -= perInstallment;
      const amount = (i === numInstallments) ? perInstallment + currentDue : perInstallment;
      const actualDue = (i === numInstallments) ? 0 : currentDue;
      
      const date = new Date(start);
      date.setMonth(start.getMonth() + (i - 1));

      installments.push({
        installmentNumber: i,
        date: date.toISOString().split('T')[0],
        amount: amount,
        dueBalance: actualDue
      });
    }
    return installments;
  };

  const calculatedInstallments = generateInstallments();

  const handlePrintPreview = () => {
    window.print();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const sum = teamShares.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
      if (sum > incentiveSetup.teamPool) {
        alert("Distributed amount exceeds Team Pool!");
        return;
      }

      const selectedProject = projectsList.find(p => p.id === dealData.projectId);
      const projectName = selectedProject ? selectedProject.projectName : 'General Project';
      
      const dealPayload = {
        leadId: leadId,
        leadName: lead?.name || 'Unknown',
        projectId: dealData.projectId,
        projectName: projectName,
        unitNo: dealData.unitNo,
        floorSize: parseFloat(dealData.floorSize || 0),
        pricePerSqft: parseFloat(dealData.pricePerSqft || 0),
        value: parseFloat(dealData.value || 0),
        downPaymentPercent: parseFloat(dealData.downPaymentPercent || 0),
        downPaymentAmount: parseFloat(dealData.downPaymentAmount || 0),
        downPaymentDate: dealData.downPaymentDate,
        incentiveThresholdPercent: parseFloat(dealData.incentiveThresholdPercent || 0),
        
        commissionRate: parseFloat(incentiveSetup.commissionRate || 0),
        totalCommission: incentiveSetup.totalCommission,
        agentCommission: incentiveSetup.agentCommission,
        teamPool: incentiveSetup.teamPool,
        hasTeamIncentive: teamShares.length > 0,
        teamShares: teamShares,
        
        numberOfInstallments: parseInt(dealData.numberOfInstallments || 0),
        installmentStartDate: dealData.installmentStartDate,
        installments: calculatedInstallments,
        
        status: 'Pending Approval',
        createdAt: serverTimestamp(),
        createdBy: user?.uid || user?.id,
        createdByName: user?.fullName || user?.name
      };

      await addDoc(collection(db, 'deals'), dealPayload);

      if (dealData.projectId) {
        const projectRef = doc(db, 'projects', dealData.projectId);
        const currentQty = parseInt(selectedProject?.totalApartments || 0);
        if (currentQty > 0) {
          await updateDoc(projectRef, {
            totalApartments: currentQty - 1,
            updatedAt: serverTimestamp()
          });
        }
      }

      navigate(`/leads/${leadId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create deal.");
    }
  };

  if (isLoading) return <DashboardLayout><div style={{padding:'40px',textAlign:'center'}}>Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="create-deal-container">
        <div className="page-header print-hide">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h2>Sales Order Form</h2>
          <div className="header-actions">
            <Button variant="outline" icon={Printer} onClick={handlePrintPreview}>Print Preview</Button>
            <Button variant="primary" icon={Save} onClick={handleSubmit}>Submit for Approval</Button>
          </div>
        </div>

        <div className="so-form-layout">
          {/* Customer Section */}
          <Card className="form-section">
            <div className="section-header">
              <User size={20} />
              <h3>Customer Information</h3>
            </div>
            <div className="customer-info-grid">
              <div className="info-item">
                <span className="label">Customer Name:</span>
                <span className="value">{lead?.name}</span>
              </div>
              <div className="info-item">
                <span className="label">Phone:</span>
                <span className="value">{lead?.phone}</span>
              </div>
              <div className="info-item">
                <span className="label">Email:</span>
                <span className="value">{lead?.email || 'N/A'}</span>
              </div>
            </div>
          </Card>

          <form id="dealForm" onSubmit={handleSubmit}>
            {/* Item Line Section */}
            <Card className="form-section">
              <div className="section-header">
                <Building size={20} />
                <h3>Item Line (Apartment Details)</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Select Project</label>
                  <select className="custom-select-field" required value={dealData.projectId} onChange={e => setDealData({...dealData, projectId: e.target.value})}>
                    <option value="">-- Choose Project --</option>
                    {projectsList.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Unit / Apartment No.</label>
                  <input className="custom-input-field" required type="text" placeholder="e.g. Flat-4A" value={dealData.unitNo} onChange={e => setDealData({...dealData, unitNo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Floor Size (sqft)</label>
                  <input className="custom-input-field" required type="number" placeholder="1500" value={dealData.floorSize} onChange={e => setDealData({...dealData, floorSize: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Price per sqft (BDT)</label>
                  <input className="custom-input-field" required type="number" placeholder="5000" value={dealData.pricePerSqft} onChange={e => setDealData({...dealData, pricePerSqft: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Total Sale Value (BDT)</label>
                  <input className="custom-input-field" required type="number" readOnly value={dealData.value} onChange={e => setDealData({...dealData, value: e.target.value})} />
                </div>
              </div>
            </Card>

            {/* Payment & Installment Section */}
            <Card className="form-section">
              <div className="section-header">
                <Calculator size={20} />
                <h3>Payment & Installment Setup</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Booking Money / DP (%)</label>
                  <input className="custom-input-field" required type="number" value={dealData.downPaymentPercent} onChange={e => setDealData({...dealData, downPaymentPercent: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Booking Money Value (BDT)</label>
                  <input className="custom-input-field" required type="number" value={dealData.downPaymentAmount} onChange={e => setDealData({...dealData, downPaymentAmount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Booking Date</label>
                  <input className="custom-input-field" required type="date" value={dealData.downPaymentDate} onChange={e => setDealData({...dealData, downPaymentDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Number of Installments (Max 36)</label>
                  <input className="custom-input-field" type="number" max="36" value={dealData.numberOfInstallments} onChange={e => setDealData({...dealData, numberOfInstallments: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Installment Start Date</label>
                  <input className="custom-input-field" type="date" value={dealData.installmentStartDate} onChange={e => setDealData({...dealData, installmentStartDate: e.target.value})} />
                </div>
              </div>

              {calculatedInstallments.length > 0 && (
                <div className="installment-preview">
                  <h4>Installment Schedule Preview</h4>
                  <div className="table-responsive">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Date</th>
                          <th>Amount (BDT)</th>
                          <th>Due Balance (BDT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatedInstallments.map((inst, i) => (
                          <tr key={i}>
                            <td>{inst.installmentNumber}</td>
                            <td>{new Date(inst.date).toLocaleDateString('en-GB')}</td>
                            <td className="amount">৳ {inst.amount.toLocaleString()}</td>
                            <td className="amount">৳ {inst.dueBalance.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>

            {/* Incentive Section */}
            <Card className="form-section">
              <div className="section-header">
                <Percent size={20} />
                <h3>Incentive Structure (1% Standard)</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Standard Commission Rate (%)</label>
                  <input className="custom-input-field" type="number" step="0.1" value={incentiveSetup.commissionRate} onChange={e => setIncentiveSetup({...incentiveSetup, commissionRate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Total Commission Pool</label>
                  <input className="custom-input-field read-only-highlight" type="text" readOnly value={`৳ ${incentiveSetup.totalCommission.toLocaleString()}`} />
                </div>
                <div className="form-group">
                  <label>Incentive Eligibility Threshold (% received)</label>
                  <input className="custom-input-field" type="number" required value={dealData.incentiveThresholdPercent} onChange={e => setDealData({...dealData, incentiveThresholdPercent: e.target.value})} />
                </div>
              </div>
              
              <div className="incentive-breakdown">
                <div className="breakdown-box primary-agent">
                  <h5>Primary Agent (60%)</h5>
                  <div className="amount">৳ {incentiveSetup.agentCommission.toLocaleString()}</div>
                  <p>Guaranteed for {user?.fullName || user?.name}</p>
                </div>
                <div className="breakdown-box team-pool">
                  <h5>Team Distribution Pool (40%)</h5>
                  <div className="amount">৳ {incentiveSetup.teamPool.toLocaleString()}</div>
                  <p>Available to share with team</p>
                </div>
              </div>

              <div className="team-distribution-setup">
                <h4>Distribute 40% Team Pool</h4>
                {teamShares.map((share, idx) => (
                  <div key={idx} className="share-row">
                    <select
                      className="custom-select-field"
                      required
                      value={share.userId}
                      onChange={e => {
                        const sel = usersList.find(u => u.id === e.target.value);
                        const arr = [...teamShares];
                        arr[idx].userId = e.target.value;
                        arr[idx].userName = sel ? (sel.fullName || sel.name) : 'User';
                        setTeamShares(arr);
                      }}
                    >
                      <option value="">Select Member</option>
                      {usersList.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name}</option>)}
                    </select>
                    <div className="share-input-wrapper">
                      <input 
                        type="number" 
                        className="custom-input-field"
                        required 
                        placeholder="Amount (BDT)"
                        value={share.value}
                        onChange={e => {
                          const arr = [...teamShares];
                          arr[idx].value = e.target.value;
                          arr[idx].type = 'amount';
                          setTeamShares(arr);
                        }}
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setTeamShares(teamShares.filter((_, i) => i !== idx))}>✕</Button>
                  </div>
                ))}
                
                <Button type="button" variant="secondary" size="sm" onClick={() => setTeamShares([...teamShares, { userId: '', userName: '', type: 'amount', value: '' }])}>
                  + Add Team Member
                </Button>
                
                {(() => {
                  const sum = teamShares.reduce((acc, curr) => acc + (parseFloat(curr.value) || 0), 0);
                  if (sum > incentiveSetup.teamPool) {
                    return <div className="error-text" style={{color:'red', marginTop:'8px'}}>Distributed amount (৳{sum}) exceeds Team Pool (৳{incentiveSetup.teamPool})!</div>;
                  }
                  return null;
                })()}
              </div>
            </Card>

          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CreateDeal;
