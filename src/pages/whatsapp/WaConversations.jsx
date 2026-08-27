import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MessageCircle, Send, User, Bot, UserCheck, RotateCcw } from 'lucide-react'
import { waConversations } from '../../services/whatsappApi'
import DashboardLayout from '../../layouts/DashboardLayout'
import './whatsapp.css'

function ConversationItem({ convo, active, onClick }) {
  const isHuman = convo.ai_status === 'HUMAN_REQUIRED' || convo.ai_status === 'MANUAL'
  return (
    <div className={`wa-convo-item ${active ? 'active' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div className="wa-convo-name">{convo.lead_name || convo.phone_number}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {convo.unread_count > 0 && <span className="wa-badge wa-badge-green">{convo.unread_count}</span>}
          {isHuman && <span className="wa-badge wa-badge-red" style={{ fontSize: '0.65rem' }}>HUMAN</span>}
          {convo.ai_status === 'ACTIVE' && <span className="wa-badge wa-badge-blue" style={{ fontSize: '0.65rem' }}>AI</span>}
        </div>
      </div>
      <div className="wa-convo-preview">{convo.last_message_preview || '—'}</div>
      <div style={{ fontSize: '0.68rem', color: '#4b5563', marginTop: 2 }}>
        {convo.last_message_at ? new Date(convo.last_message_at).toLocaleString() : ''}
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isInbound = msg.direction === 'INBOUND'
  return (
    <div className={`wa-msg wa-msg-${isInbound ? 'inbound' : 'outbound'}`}>
      <div>{msg.message_body}</div>
      <div className="wa-msg-ai-badge" style={{ textAlign: isInbound ? 'left' : 'right' }}>
        {msg.is_ai_generated && '🤖 AI ·'} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {msg.status === 'FAILED' && ' · ⚠ Failed'}
      </div>
    </div>
  )
}

export default function WaConversations() {
  const [convos, setConvos]       = useState([])
  const [selected, setSelected]   = useState(null)
  const [messages, setMessages]   = useState([])
  const [msgInput, setMsgInput]   = useState('')
  const [sending, setSending]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const msgEndRef = useRef(null)

  const loadConvos = useCallback(async () => {
    const res = await waConversations.list(filterStatus ? { ai_status: filterStatus } : {}).catch(() => ({ conversations: [] }))
    setConvos(res.conversations || [])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { loadConvos() }, [loadConvos])

  // Poll for new messages when a conversation is open
  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => loadMessages(selected), 5000)
    return () => clearInterval(t)
  }, [selected])

  const loadMessages = async (convo) => {
    setMsgLoading(true)
    const res = await waConversations.getMessages(convo.id).catch(() => ({ messages: [] }))
    setMessages(res.messages || [])
    setMsgLoading(false)
    // Mark as read
    await waConversations.markRead(convo.id).catch(() => null)
    await loadConvos()
  }

  const selectConvo = async (convo) => {
    setSelected(convo)
    setMessages([])
    await loadMessages(convo)
  }

  // Scroll to bottom on new messages
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if (!msgInput.trim() || !selected || sending) return
    setSending(true)
    try {
      await waConversations.reply(selected.id, msgInput.trim())
      setMsgInput('')
      await loadMessages(selected)
    } catch (err) { alert(err.message) }
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleTakeover = async () => {
    if (!selected) return
    await waConversations.takeover(selected.id)
    await loadConvos()
    setSelected(prev => prev ? { ...prev, ai_status: 'MANUAL' } : prev)
  }

  const handleResumeAI = async () => {
    if (!selected) return
    await waConversations.resumeAI(selected.id)
    await loadConvos()
    setSelected(prev => prev ? { ...prev, ai_status: 'ACTIVE' } : prev)
  }

  return (
    <DashboardLayout>
      <div className="wa-page" style={{ padding: 0, height: 'calc(100vh - 64px)' }}>
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="wa-page-title" style={{ fontSize: '1.1rem' }}><MessageCircle size={20} className="wa-icon" /> Conversations</h1>
        <select className="wa-form-select" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.82rem' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All conversations</option>
          <option value="ACTIVE">AI Active</option>
          <option value="HUMAN_REQUIRED">Needs Human</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>

      <div className="wa-chat-container" style={{ height: 'calc(100% - 64px)', borderRadius: 0, border: 'none' }}>
        {/* Conversation list */}
        <div className="wa-convo-list">
          {loading ? (
            <div className="wa-empty" style={{ padding: 24 }}><div className="wa-spinner" /></div>
          ) : convos.length === 0 ? (
            <div className="wa-empty" style={{ padding: 24 }}><div className="wa-empty-icon">💬</div><p style={{ fontSize: '0.8rem' }}>No conversations yet</p></div>
          ) : (
            convos.map(c => (
              <ConversationItem key={c.id} convo={c} active={selected?.id === c.id} onClick={() => selectConvo(c)} />
            ))
          )}
        </div>

        {/* Chat panel */}
        <div className="wa-chat-panel">
          {!selected ? (
            <div className="wa-empty" style={{ flex: 1 }}>
              <div className="wa-empty-icon">💬</div>
              <p>Select a conversation to start chatting</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="wa-chat-header">
                <div>
                  <div style={{ fontWeight: 600 }}>{selected.lead_name || selected.phone_number}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{selected.phone_number}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`wa-badge wa-badge-${selected.ai_status === 'ACTIVE' ? 'blue' : selected.ai_status === 'HUMAN_REQUIRED' ? 'red' : 'gray'}`}>
                    {selected.ai_status === 'ACTIVE' ? '🤖 AI' : selected.ai_status === 'HUMAN_REQUIRED' ? '⚠ Needs Human' : '👤 Manual'}
                  </span>
                  {selected.ai_status !== 'MANUAL' && selected.ai_status !== 'HUMAN_REQUIRED' && (
                    <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 10px' }} onClick={handleTakeover}>
                      <UserCheck size={13} /> Take Over
                    </button>
                  )}
                  {(selected.ai_status === 'MANUAL' || selected.ai_status === 'HUMAN_REQUIRED') && (
                    <button className="wa-btn wa-btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 10px' }} onClick={handleResumeAI}>
                      <Bot size={13} /> Resume AI
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="wa-messages-area">
                {msgLoading && messages.length === 0 && <div className="wa-empty" style={{ flex: 1 }}><div className="wa-spinner" /></div>}
                {messages.map(m => <Message key={m.id} msg={m} />)}
                <div ref={msgEndRef} />
              </div>

              {/* Input */}
              <div className="wa-chat-input-row">
                <textarea
                  className="wa-chat-input"
                  rows={2}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="wa-btn wa-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={sending || !msgInput.trim()} onClick={handleSend}>
                  {sending ? <span className="wa-spinner" style={{ width: 16, height: 16 }} /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  )
}
