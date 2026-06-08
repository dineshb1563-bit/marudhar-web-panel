import React, { useEffect, useState, useMemo } from 'react'
import {
    Drawer, message, Table, Button,
    Typography, Tag, Modal, Select, Input, Radio,
    Space, Tabs, Badge
} from 'antd'
import {
    DeleteOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined,
    WarningOutlined,
    SearchOutlined,
    UserOutlined,
    TeamOutlined,
    CheckOutlined,
    CloseOutlined,
    CopyOutlined
} from '@ant-design/icons'
import {
    collection, getDocs, doc, deleteDoc, query, where,
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { db } from '@/lib/firebase'

const { Text } = Typography
const { TabPane } = Tabs

/* ─── Design tokens ─────────────────────────────────────────────────── */
const t = {
    red:   { bg: '#fff1f0', border: '#ffa39e', text: '#cf1322' },
    amber: { bg: '#fffbe6', border: '#ffe58f', text: '#d46b08' },
    green: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d' },
    blue:  { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' },
}

const styles = {
    sectionLabel: {
        fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#8c8c8c',
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
    },
    statsGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: 10, margin: '14px 0',
    },
    statCard: {
        background: '#fafafa', borderRadius: 8,
        padding: '12px 14px', border: '0.5px solid #f0f0f0',
    },
    statLabel: {
        fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: '#8c8c8c', marginBottom: 4,
    },
    statValue: (color) => ({
        fontSize: 22, fontWeight: 500, lineHeight: 1, color: color || 'inherit',
    }),
    warningBox: {
        background: t.red.bg, border: `0.5px solid ${t.red.border}`,
        borderRadius: 8, padding: '12px 14px', marginTop: 16,
    },
    infoBox: {
        background: t.blue.bg, border: `0.5px solid ${t.blue.border}`,
        borderRadius: 8, padding: '12px 14px', marginBottom: 14,
    },
    infoBoxTitle: {
        fontSize: 13, fontWeight: 600, color: t.blue.text,
        marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
    },
    breakdownGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 8, maxHeight: 180, overflow: 'auto', margin: '10px 0 14px',
    },
    breakdownCard: {
        background: '#fff', border: '0.5px solid #f0f0f0',
        borderRadius: 8, padding: '10px 12px',
    },
    footer: {
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '0.5px solid #f0f0f0',
    },
    deletePill: {
        fontSize: 11, padding: '2px 8px', borderRadius: 999,
        background: 'rgba(255,255,255,0.25)', color: '#fff',
        fontWeight: 600, marginLeft: 6,
        border: '0.5px solid rgba(255,255,255,0.3)',
    },
}

/* ─── Component ──────────────────────────────────────────────────────── */
const DeleteUnlinkedPayments = ({ open, setOpen, user, selectedProgram, allClosingMembers }) => {
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [unlinkedPayments, setUnlinkedPayments] = useState([])
    const [duplicatePayments, setDuplicatePayments] = useState([])
    const [selectedRowKeys, setSelectedRowKeys] = useState([])
    const [searchText, setSearchText] = useState('')
    const [deleteMode, setDeleteMode] = useState('all')
    const [selectedClosingMemberIds, setSelectedClosingMemberIds] = useState([])
    const [stats, setStats] = useState({ totalUnlinked: 0, byClosingMember: {}, totalAmount: 0 })
    const [duplicateStats, setDuplicateStats] = useState({ totalDuplicates: 0, totalAmount: 0 })
    const [activeTab, setActiveTab] = useState('unlinked')

    // ── FIX: controlled modal state instead of Modal.confirm() ──
    const [confirmModalOpen, setConfirmModalOpen] = useState(false)
    const [pendingDeleteIds, setPendingDeleteIds] = useState([])

    // Prepare options with useMemo to avoid duplicates
    const closingMemberOptions = useMemo(() => {
        const options = allClosingMembers.map(member => ({
            label: `${member.displayName} (${member.registrationNumber || 'N/A'}) — ${member.closingGroupName || 'No Group'}`,
            value: member.id,
            data: member,
        }))
        return options
    }, [allClosingMembers])

    // Handle select change
    const handleClosingMemberChange = (values) => {
        const cleanValues = values.filter(v => v && v !== 'SELECT_ALL')
        setSelectedClosingMemberIds(cleanValues)
        setSelectedRowKeys([])
    }

    // Select all members
    const handleSelectAll = () => {
        const allIds = allClosingMembers.map(m => m.id)
        setSelectedClosingMemberIds(allIds)
        setSelectedRowKeys([])
        message.success(`Selected ${allIds.length} closing members`)
    }

    // Clear all selections
    const handleClearAll = () => {
        setSelectedClosingMemberIds([])
        setSelectedRowKeys([])
        message.info('Cleared all selections')
    }

    // Find duplicate payments (same closingMemberId + same memberId)
    const findDuplicatePayments = (payments) => {
        const duplicateMap = new Map()
        const duplicates = []

        payments.forEach(payment => {
            const key = `${payment.closingMemberId}_${payment.memberId}`
            if (!duplicateMap.has(key)) {
                duplicateMap.set(key, [])
            }
            duplicateMap.get(key).push(payment)
        })

        duplicateMap.forEach((value, key) => {
            if (value.length > 1) {
                // Keep the latest one, mark others as duplicate
                const sorted = value.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                const keepOriginal = sorted[0]
                const duplicateEntries = sorted.slice(1)
                
                duplicateEntries.forEach(dup => {
                    duplicates.push({
                        ...dup,
                        duplicateOf: keepOriginal.id,
                        originalPaymentFor: keepOriginal.paymentFor
                    })
                })
            }
        })

        return duplicates
    }

    /* ── fetch unlinked payments ── */
    const fetchUnlinkedPayments = async () => {
        if (!user?.uid || !selectedProgram?.id) return
        if (!selectedClosingMemberIds.length) {
            setUnlinkedPayments([])
            setDuplicatePayments([])
            setStats({ totalUnlinked: 0, byClosingMember: {}, totalAmount: 0 })
            setDuplicateStats({ totalDuplicates: 0, totalAmount: 0 })
            return
        }
        setLoading(true)
        try {
            const ref = collection(db, `users/${user.uid}/programs/${selectedProgram.id}/payment_pending`)
            const snap = await getDocs(query(ref, where('delete_flag', '==', false)))
            const selectedSet = new Set(selectedClosingMemberIds)
            const allPayments = []
            let totalAmount = 0
            const byClosingMember = {}

            for (const payDoc of snap.docs) {
                const data = payDoc.data()
                const amt = data.payAmount || 200
                
                allPayments.push({
                    key: payDoc.id, 
                    id: payDoc.id, 
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
                })
                
                if (!selectedSet.has(data.closingMemberId)) {
                    totalAmount += amt
                    const cid = data.closingMemberId
                    if (!byClosingMember[cid]) {
                        byClosingMember[cid] = {
                            count: 0, amount: 0,
                            name: data.paymentFor || cid,
                            regNo: data.closingRegNo || 'N/A',
                        }
                    }
                    byClosingMember[cid].count++
                    byClosingMember[cid].amount += amt
                }
            }
            
            // Filter unlinked payments
            const unlinked = allPayments.filter(p => !selectedSet.has(p.closingMemberId))
            setUnlinkedPayments(unlinked)
            setStats({ totalUnlinked: unlinked.length, byClosingMember, totalAmount })
            
            // Find duplicates in unlinked payments
            const duplicates = findDuplicatePayments(unlinked)
            setDuplicatePayments(duplicates)
            
            const duplicateTotalAmount = duplicates.reduce((sum, dup) => sum + (dup.payAmount || 200), 0)
            setDuplicateStats({ 
                totalDuplicates: duplicates.length, 
                totalAmount: duplicateTotalAmount 
            })
            
            if (duplicates.length > 0) {
                message.warning(`Found ${duplicates.length} duplicate payment entries!`)
            }
            
        } catch (e) {
            console.error(e)
            message.error('Failed to fetch payment entries: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    /* ── step 1: collect IDs and open the controlled modal ── */
    const handleDeletePayments = () => {
        let ids = []
        let deleteMessage = ''
        
        if (activeTab === 'duplicates') {
            ids = duplicatePayments.map(p => p.id)
            deleteMessage = `duplicate (${ids.length})`
        } else {
            ids = deleteMode === 'all'
                ? unlinkedPayments.map(p => p.id)
                : selectedRowKeys
        }

        if (!ids.length) {
            message.warning('No payments to delete')
            return
        }

        setPendingDeleteIds(ids)
        setConfirmModalOpen(true)
    }

    // Delete specific duplicate entries only
    const handleDeleteDuplicatesOnly = () => {
        if (duplicatePayments.length === 0) {
            message.warning('No duplicate entries found')
            return
        }

        setPendingDeleteIds(duplicatePayments.map(p => p.id))
        setConfirmModalOpen(true)
    }

    /* ── step 2: execute deletion after user confirms in modal ── */
    const executeDelete = async () => {
        setConfirmModalOpen(false)
        setDeleting(true)
        let success = 0, errors = 0

        for (const id of pendingDeleteIds) {
            try {
                await deleteDoc(
                    doc(db, `users/${user.uid}/programs/${selectedProgram.id}/payment_pending/${id}`)
                )
                success++
            } catch (err) {
                console.error(`Error deleting ${id}:`, err)
                errors++
            }
        }

        if (success) message.success(`Deleted ${success} payment ${success === 1 ? 'entry' : 'entries'}`)
        if (errors) message.error(`Failed to delete ${errors} ${errors === 1 ? 'entry' : 'entries'}`)

        setSelectedRowKeys([])
        setPendingDeleteIds([])
        setDeleting(false)
        await fetchUnlinkedPayments()
    }

    /* ── search filter ── */
    const filteredPayments = (activeTab === 'duplicates' ? duplicatePayments : unlinkedPayments).filter(p => {
        if (!searchText) return true
        const s = searchText.toLowerCase()
        return (
            p.paymentFor?.toLowerCase().includes(s) ||
            p.memberDetails?.displayName?.toLowerCase().includes(s) ||
            p.closingRegNo?.toLowerCase().includes(s) ||
            p.memberDetails?.registrationNumber?.toLowerCase().includes(s) ||
            p.memberDetails?.phone?.toLowerCase().includes(s)
        )
    })

    useEffect(() => {
        if (open && user?.uid && selectedProgram?.id) {
            setSelectedClosingMemberIds([])
            setSelectedRowKeys([])
            setSearchText('')
            setActiveTab('unlinked')
        }
    }, [open, user?.uid, selectedProgram?.id])

    useEffect(() => {
        if (selectedClosingMemberIds.length > 0) {
            fetchUnlinkedPayments()
        } else {
            setUnlinkedPayments([])
            setDuplicatePayments([])
            setStats({ totalUnlinked: 0, byClosingMember: {}, totalAmount: 0 })
            setDuplicateStats({ totalDuplicates: 0, totalAmount: 0 })
        }
    }, [selectedClosingMemberIds])

    /* ── table columns ── */
    const baseColumns = [
        {
            title: '#', key: 'index', width: 48,
            render: (_, __, i) => <span style={{ color: '#8c8c8c', fontSize: 12 }}>{i + 1}</span>,
        },
        {
            title: 'Closing member', dataIndex: 'paymentFor', key: 'paymentFor', width: 190,
            render: (text, record) => (
                <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{text || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Reg: {record.closingRegNo || 'N/A'}</div>
                    {record.closingFatherName && (
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Father: {record.closingFatherName}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Paying member', dataIndex: 'memberDetails', key: 'memberDetails', width: 190,
            render: (details, record) => (
                <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{details?.displayName || record.memberId}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Reg: {details?.registrationNumber || 'N/A'}</div>
                    {details?.phone && <div style={{ fontSize: 11, color: '#8c8c8c' }}>Ph: {details.phone}</div>}
                </div>
            ),
        },
        {
            title: 'Amount', dataIndex: 'payAmount', key: 'payAmount', width: 90,
            render: (amt) => <span style={{ fontWeight: 500 }}>₹{amt || 200}</span>,
        },
        {
            title: 'Due date', dataIndex: 'dueDate', key: 'dueDate', width: 110,
            render: (d) => {
                const overdue = d && dayjs(d, 'DD-MM-YYYY').isBefore(dayjs())
                return <Tag color={overdue ? 'red' : 'blue'} style={{ fontSize: 11 }}>{d || 'N/A'}</Tag>
            },
        },
        {
            title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 130,
            render: (d) => (
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>{dayjs(d).format('DD-MM-YYYY HH:mm')}</span>
            ),
        },
    ]

    // Add duplicate info column for duplicates tab
    const duplicateColumns = [
        ...baseColumns,
        {
            title: 'Duplicate Info', key: 'duplicateInfo', width: 150,
            render: (_, record) => (
                <Tag color="red" icon={<CopyOutlined />}>
                    Duplicate of: {record.originalPaymentFor || record.duplicateOf}
                </Tag>
            ),
        }
    ]

    const rowSelection = {
        selectedRowKeys,
        onChange: setSelectedRowKeys,
        getCheckboxProps: (record) => ({ 
            disabled: deleteMode === 'all' || activeTab === 'duplicates'
        }),
    }

    const deleteCount = activeTab === 'duplicates' 
        ? duplicatePayments.length 
        : (deleteMode === 'all' ? unlinkedPayments.length : selectedRowKeys.length)

    const handleClose = () => {
        setOpen(false)
        setSelectedClosingMemberIds([])
        setSelectedRowKeys([])
        setSearchText('')
        setActiveTab('unlinked')
    }

    // Custom dropdown renderer with select all in menu
    const dropdownRender = (menu) => {
        return (
            <div>
                <div style={{ 
                    padding: '8px 12px', 
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontWeight: 500, fontSize: 12 }}>Quick Actions</span>
                    <Space size={8}>
                        <Button 
                            type="link" 
                            size="small"
                            onClick={handleSelectAll}
                            icon={<CheckOutlined />}
                        >
                            Select All ({allClosingMembers.length})
                        </Button>
                        <Button 
                            type="link" 
                            size="small"
                            onClick={handleClearAll}
                            icon={<CloseOutlined />}
                        >
                            Clear All
                        </Button>
                    </Space>
                </div>
                {menu}
            </div>
        )
    }

    return (
        <>
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                        <DeleteOutlined style={{ color: t.red.text }} />
                        Delete Payment Entries
                    </div>
                }
                placement="right"
                onClose={handleClose}
                open={open}
                width="85%"
                bodyStyle={{ padding: '18px 20px' }}
                destroyOnHidden
                footer={
                    <div style={styles.footer}>
                        <Button onClick={handleClose}>Close</Button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                                {activeTab === 'duplicates' 
                                    ? `${duplicatePayments.length} duplicate entries will be deleted`
                                    : (deleteMode === 'all'
                                        ? `${unlinkedPayments.length} entries will be deleted`
                                        : `${selectedRowKeys.length} of ${unlinkedPayments.length} selected`)}
                            </span>
                            <Button
                                danger
                                type="primary"
                                icon={<DeleteOutlined />}
                                onClick={handleDeletePayments}
                                loading={deleting}
                                disabled={deleteCount === 0}
                            >
                                {activeTab === 'duplicates' 
                                    ? `Delete all duplicates (${duplicatePayments.length})`
                                    : (deleteMode === 'all' ? 'Delete all unlinked' : 'Delete selected')}
                                {deleteCount > 0 && (
                                    <span style={styles.deletePill}>{deleteCount}</span>
                                )}
                            </Button>
                        </div>
                    </div>
                }
            >
                {/* ── Closing member select ── */}
                <div style={{ marginBottom: 14 }}>
                    <div style={styles.sectionLabel}>
                        <TeamOutlined /> Select closing members (marriage cases)
                    </div>
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Search by name, reg. no. or group…"
                        value={selectedClosingMemberIds}
                        onChange={handleClosingMemberChange}
                        options={closingMemberOptions}
                        showSearch
                        filterOption={(input, opt) => {
                            return opt.label.toLowerCase().includes(input.toLowerCase())
                        }}
                        loading={allClosingMembers.length === 0}
                        maxTagCount="responsive"
                        maxTagPlaceholder={(o) => `+${o.length} more`}
                        notFoundContent="No closing members found"
                        dropdownRender={dropdownRender}
                    />
                    {selectedClosingMemberIds.length > 0 && (
                        <div style={{ fontSize: 12, color: '#52c41a', marginTop: 5 }}>
                            ✓ {selectedClosingMemberIds.length} closing member{selectedClosingMemberIds.length > 1 ? 's' : ''} selected
                        </div>
                    )}
                </div>

                {selectedClosingMemberIds.length > 0 && (
                    <>
                        {/* ── Stats row ── */}
                        <div style={styles.statsGrid}>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Unlinked entries</div>
                                <div style={styles.statValue(t.amber.text)}>{stats.totalUnlinked}</div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Unlinked amount</div>
                                <div style={styles.statValue(t.red.text)}>₹{stats.totalAmount.toLocaleString()}</div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Duplicate entries</div>
                                <div style={styles.statValue(t.red.text)}>
                                    {duplicateStats.totalDuplicates}
                                    {duplicateStats.totalDuplicates > 0 && (
                                        <Badge count="⚠️" style={{ marginLeft: 8 }} />
                                    )}
                                </div>
                            </div>
                            <div style={styles.statCard}>
                                <div style={styles.statLabel}>Selected members</div>
                                <div style={styles.statValue(t.green.text)}>{selectedClosingMemberIds.length}</div>
                            </div>
                        </div>

                        {/* ── Tabs for Unlinked and Duplicates ── */}
                        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 8 }}>
                            <TabPane 
                                tab={
                                    <span>
                                        <UserOutlined />
                                        Unlinked Entries ({stats.totalUnlinked})
                                    </span>
                                } 
                                key="unlinked"
                            >
                                {/* ── Delete mode + search toolbar ── */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <Radio.Group
                                        value={deleteMode}
                                        onChange={(e) => {
                                            setDeleteMode(e.target.value)
                                            if (e.target.value === 'all') setSelectedRowKeys([])
                                        }}
                                        buttonStyle="solid"
                                        size="small"
                                    >
                                        <Radio.Button value="all">Delete all ({unlinkedPayments.length})</Radio.Button>
                                        <Radio.Button value="selected">Select specific</Radio.Button>
                                    </Radio.Group>

                                    <Input
                                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                        placeholder="Search name, reg. no., phone…"
                                        allowClear
                                        style={{ flex: 1, minWidth: 220 }}
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        size="small"
                                    />

                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={fetchUnlinkedPayments}
                                        loading={loading}
                                        size="small"
                                    >
                                        Refresh
                                    </Button>
                                </div>

                                {/* ── Table ── */}
                                <Table
                                    rowSelection={deleteMode === 'selected' ? rowSelection : undefined}
                                    columns={baseColumns}
                                    dataSource={filteredPayments}
                                    loading={loading || deleting}
                                    size="small"
                                    scroll={{ x: 900, y: 'calc(100vh - 560px)' }}
                                    pagination={{
                                        pageSize: 25,
                                        showSizeChanger: true,
                                        showQuickJumper: true,
                                        showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
                                        size: 'small',
                                    }}
                                    locale={{
                                        emptyText: loading
                                            ? 'Scanning for unlinked entries…'
                                            : 'No unlinked payment entries found.',
                                    }}
                                />
                            </TabPane>

                            <TabPane 
                                tab={
                                    <span>
                                        <CopyOutlined />
                                        Duplicate Entries ({duplicateStats.totalDuplicates})
                                        {duplicateStats.totalDuplicates > 0 && (
                                            <Badge count={duplicateStats.totalDuplicates} style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} />
                                        )}
                                    </span>
                                } 
                                key="duplicates"
                            >
                                {duplicatePayments.length > 0 ? (
                                    <>
                                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text type="secondary">
                                                Found {duplicatePayments.length} duplicate entries. Total amount: ₹{duplicateStats.totalAmount.toLocaleString()}
                                            </Text>
                                            <Button
                                                danger
                                                size="small"
                                                onClick={handleDeleteDuplicatesOnly}
                                                icon={<DeleteOutlined />}
                                                disabled={deleting}
                                            >
                                                Delete All Duplicates ({duplicatePayments.length})
                                            </Button>
                                        </div>
                                        <Table
                                            columns={duplicateColumns}
                                            dataSource={filteredPayments}
                                            loading={loading || deleting}
                                            size="small"
                                            scroll={{ x: 1000, y: 'calc(100vh - 560px)' }}
                                            pagination={{
                                                pageSize: 25,
                                                showSizeChanger: true,
                                                showQuickJumper: true,
                                                showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
                                                size: 'small',
                                            }}
                                            rowKey="id"
                                        />
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
                                        <CopyOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                                        <div>No duplicate entries found</div>
                                    </div>
                                )}
                            </TabPane>
                        </Tabs>

                        {/* ── Warning note ── */}
                        {(unlinkedPayments.length > 0 || duplicatePayments.length > 0) && (
                            <div style={styles.warningBox}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <WarningOutlined style={{ color: t.red.text }} />
                                    <span style={{ fontWeight: 600, fontSize: 13, color: t.red.text }}>Before you delete</span>
                                </div>
                                {unlinkedPayments.length > 0 && (
                                    <div style={{ fontSize: 12, color: '#595959', marginTop: 3, paddingLeft: 2 }}>
                                        · {unlinkedPayments.length} entries are not linked to any of your selected closing members.
                                    </div>
                                )}
                                {duplicatePayments.length > 0 && (
                                    <div style={{ fontSize: 12, color: '#595959', marginTop: 3, paddingLeft: 2 }}>
                                        · {duplicatePayments.length} duplicate entries found (same closing member + same paying member).
                                    </div>
                                )}
                                <div style={{ fontSize: 12, color: '#595959', marginTop: 3, paddingLeft: 2 }}>
                                    · Deleting will clear total amount of ₹{(stats.totalAmount + duplicateStats.totalAmount).toLocaleString()}
                                </div>
                                <div style={{ fontSize: 12, color: '#595959', marginTop: 3, paddingLeft: 2 }}>
                                    · This action cannot be undone.
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Drawer>

            {/* Confirmation modal */}
            <Modal
                open={confirmModalOpen}
                onCancel={() => {
                    setConfirmModalOpen(false)
                    setPendingDeleteIds([])
                }}
                onOk={executeDelete}
                okText={`Delete ${pendingDeleteIds.length} ${pendingDeleteIds.length === 1 ? 'entry' : 'entries'}`}
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ExclamationCircleOutlined style={{ color: t.red.text }} />
                        <span>Delete payment entries</span>
                    </div>
                }
                centered
                maskClosable={false}
                zIndex={1100}
            >
                <div style={{ padding: '8px 0' }}>
                    <p style={{ marginBottom: 8 }}>
                        You are about to delete <strong>{pendingDeleteIds.length}</strong> payment entries.
                    </p>
                    <div style={{
                        background: t.red.bg,
                        border: `0.5px solid ${t.red.border}`,
                        borderRadius: 6,
                        padding: '10px 12px',
                    }}>
                        <div style={{ fontSize: 13, color: t.red.text, fontWeight: 600, marginBottom: 4 }}>
                            This action cannot be undone.
                        </div>
                        <div style={{ fontSize: 12, color: '#595959' }}>
                            {activeTab === 'duplicates' 
                                ? 'These are duplicate entries that will be removed.'
                                : 'These entries are not linked to your selected closing members.'}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    )
}

export default DeleteUnlinkedPayments