"use client";
import { useAuth } from '@/lib/AuthProvider';
import { getAgentMemberPaystatus } from '@/lib/helper';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Table, 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Button, 
  Avatar, 
  Space, 
  Input, 
  Select, 
  DatePicker, 
  Tooltip,
  Badge,
  Modal,
  message,
  Drawer,
  Checkbox,
  Divider,
  Alert,
  Radio
} from 'antd';
import { 
  EyeOutlined, 
  DownloadOutlined, 
  FilterOutlined,
  ReloadOutlined,
  MoneyCollectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SearchOutlined,
  PhoneOutlined,
  IdcardOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import PaymentReportPDF from '../component/pdfcom/PaymentReportPDF';
import { setSelectedProgram } from '@/redux/slices/commonSlice';

const { RangePicker } = DatePicker;
const { Search } = Input;
const { Option } = Select;

const MemberPayStatus = ({ agentId, agentInfo }) => {
    const [open, setOpen] = useState(false);
    const selectedProgram = useSelector((state) => state.data.selectedProgram);
      const programList = useSelector((state) => state.data.programList);
    const { user } = useAuth();
    const dispatch = useDispatch();
       const handleProgramSelect = (programId) => {
        dispatch(setSelectedProgram(programList.find(program => program.id === programId)));
      };
    // State variables
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalMembers: 0,
        totalPending: 0,
        totalPaid: 0,
        totalPendingAmount: 0,
        totalPaidAmount: 0,
        totalAmount: 0
    });
    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedMember, setSelectedMember] = useState(null);
    const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
    const [filteredData, setFilteredData] = useState([]);
    
    // Member selection state
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [selectionMode, setSelectionMode] = useState('all'); // 'all' or 'custom'
    const [selectAll, setSelectAll] = useState(false);

    // Load agent payment data
    async function loadAgentPaymentData() {
        try {
            setLoading(true);
            const data = await getAgentMemberPaystatus({
                userId: user.uid,
                programId: selectedProgram.id,
                agentId: agentId,
            });
            
            if (data?.success) {
                setReportData(data.report || []);
                setSummary(data.summary || {});
                setFilteredData(data.report || []);
            } else {
                message.error(data?.message || 'Failed to load payment data');
            }
        } catch (err) {
            console.error("Error loading payment data:", err);
            message.error('Error loading payment data');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAgentPaymentData();
    }, [selectedProgram?.id, agentId, user?.uid]);

    // Apply filters
    useEffect(() => {
        let filtered = [...reportData];

        // Apply search filter
        if (searchText.trim()) {
            const searchLower = searchText.toLowerCase();
            filtered = filtered.filter(member => 
                (member.displayName && member.displayName.toLowerCase().includes(searchLower)) ||
                (member.fatherName && member.fatherName.toLowerCase().includes(searchLower)) ||
                (member.phone && member.phone.includes(searchText)) ||
                (member.registrationNumber && member.registrationNumber.toLowerCase().includes(searchLower)) ||
                (member.marriages && member.marriages.some(marriage => 
                    (marriage.closingMemberName && marriage.closingMemberName.toLowerCase().includes(searchLower)) ||
                    (marriage.paymentFor && marriage.paymentFor.toLowerCase().includes(searchLower))
                ))
            );
        }

        // Apply date filter
        if (dateRange && dateRange[0] && dateRange[1]) {
            const startDate = dateRange[0].startOf('day').unix();
            const endDate = dateRange[1].endOf('day').unix();
            
            filtered = filtered.filter(member => 
                member.marriages.some(marriage => {
                    if (!marriage.createdDate) return false;
                    const marriageDate = dayjs(marriage.createdDate).unix();
                    return marriageDate >= startDate && marriageDate <= endDate;
                })
            );
        }

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(member => 
                member.marriages.some(marriage => marriage.status === statusFilter)
            );
        }

        setFilteredData(filtered);
        
        // Reset selection when filters change
        setSelectedMembers([]);
        setSelectAll(false);
        setSelectionMode('all');
    }, [searchText, dateRange, statusFilter, reportData]);

    // Handle member selection
    const handleMemberSelection = (memberId, checked) => {
        if (checked) {
            setSelectedMembers([...selectedMembers, memberId]);
        } else {
            setSelectedMembers(selectedMembers.filter(id => id !== memberId));
            setSelectAll(false);
        }
    };

    const handleSelectAll = (checked) => {
        setSelectAll(checked);
        if (checked) {
            setSelectedMembers(filteredData.map(m => m.memberId));
            setSelectionMode('custom');
        } else {
            setSelectedMembers([]);
        }
    };

    // Row selection configuration
    const rowSelection = {
        selectedRowKeys: selectedMembers,
        onChange: (selectedRowKeys) => {
            setSelectedMembers(selectedRowKeys);
            setSelectionMode('custom');
            if (selectedRowKeys.length === filteredData.length) {
                setSelectAll(true);
            } else {
                setSelectAll(false);
            }
        },
    };

    // Reset filters
    const resetFilters = () => {
        setSearchText('');
        setDateRange(null);
        setStatusFilter('all');
        setFilteredData(reportData);
        setSelectedMembers([]);
        setSelectAll(false);
        setSelectionMode('all');
    };

    // Get status tag
    const getStatusTag = (status) => {
        switch (status) {
            case 'pending':
                return <Tag color="orange" icon={<ClockCircleOutlined />}>Pending</Tag>;
            case 'paid':
                return <Tag color="green" icon={<CheckCircleOutlined />}>Paid</Tag>;
            default:
                return <Tag color="default">{status}</Tag>;
        }
    };

    // Calculate member statistics
    const calculateMemberStats = (member) => {
        const pendingMarriages = member.marriages.filter(m => m.status === 'pending').length;
        const paidMarriages = member.marriages.filter(m => m.status === 'paid').length;
        const pendingAmount = member.marriages.filter(m => m.status === 'pending').reduce((sum, m) => sum + (m.amount || 0), 0);
        const paidAmount = member.marriages.filter(m => m.status === 'paid').reduce((sum, m) => sum + (m.amount || 0), 0);
        
        return { pendingMarriages, paidMarriages, pendingAmount, paidAmount };
    };

    // Table columns
    const columns = [
        {
            title: 'Member Info',
            dataIndex: 'memberInfo',
            key: 'memberInfo',
            fixed: 'left',
            width: 250,
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar 
                        src={record.photoURL} 
                        size="large" 
                        icon={!record.photoURL && <UserOutlined />}
                        className="border border-gray-200"
                    />
                    <div>
                        <div className="font-semibold text-base flex items-center gap-2">
                            {record.displayName}
                            {record.surname && <span className="text-gray-600">{record.surname}</span>}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                            <IdcardOutlined />
                            {record.registrationNumber}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                            <UserOutlined />
                            {record.fatherName ? `S/o ${record.fatherName}` : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                            <PhoneOutlined />
                            {record.phone || 'N/A'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Village',
            dataIndex: 'address',
            key: 'address',
            width: 180,
            render: (_, record) => (
                <div>
                    <div className="font-medium">{record.village || 'N/A'}</div>
                </div>
            ),
        },
        {
            title: 'Payment Summary',
            dataIndex: 'paymentSummary',
            key: 'paymentSummary',
            width: 200,
            render: (_, record) => {
                const stats = calculateMemberStats(record);
                return (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Pending:</span>
                            <Badge 
                                count={stats.pendingMarriages} 
                                style={{ backgroundColor: '#fa8c16' }}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Paid:</span>
                            <Badge 
                                count={stats.paidMarriages} 
                                style={{ backgroundColor: '#52c41a' }}
                            />
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-medium">Total:</span>
                            <span className="font-bold text-blue-600">
                                ₹{(stats.pendingAmount + stats.paidAmount).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Pending Amount',
            dataIndex: 'pendingAmount',
            key: 'pendingAmount',
            width: 150,
            render: (_, record) => {
                const pendingAmount = record.marriages
                    .filter(m => m.status === 'pending')
                    .reduce((sum, m) => sum + (m.amount || 0), 0);
                return (
                    <div className="text-right">
                        <span className="text-lg font-bold text-orange-600">
                            ₹{pendingAmount.toLocaleString('en-IN')}
                        </span>
                    </div>
                );
            },
        },
        {
            title: 'Paid Amount',
            dataIndex: 'paidAmount',
            key: 'paidAmount',
            width: 150,
            render: (_, record) => {
                const paidAmount = record.marriages
                    .filter(m => m.status === 'paid')
                    .reduce((sum, m) => sum + (m.amount || 0), 0);
                return (
                    <div className="text-right">
                        <span className="text-lg font-bold text-green-600">
                            ₹{paidAmount.toLocaleString('en-IN')}
                        </span>
                    </div>
                );
            },
        },
        {
            title: 'Status',
            dataIndex: 'overallStatus',
            key: 'overallStatus',
            width: 120,
            render: (_, record) => {
                const pendingCount = record.marriages.filter(m => m.status === 'pending').length;
                const paidCount = record.marriages.filter(m => m.status === 'paid').length;
                
                if (pendingCount === 0 && paidCount === 0) {
                    return <Tag color="default">No Payments</Tag>;
                } else if (pendingCount === 0) {
                    return <Tag color="success">All Paid</Tag>;
                } else if (paidCount === 0) {
                    return <Tag color="error">All Pending</Tag>;
                } else {
                    return <Tag color="warning">Partial</Tag>;
                }
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="View Details">
                        <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            size="small"
                            onClick={() => {
                                setSelectedMember(record);
                                setIsDetailsModalVisible(true);
                            }}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    // Marriage details table columns for modal
    const marriageColumns = [
        {
            title: 'Payment For',
            dataIndex: 'paymentFor',
            key: 'paymentFor',
            width: 150,
        },
        {
            title: 'Closing Member',
            dataIndex: 'closingMember',
            key: 'closingMember',
            width: 200,
            render: (_, record) => (
                <div>
                    <div>{record.paymentFor || 'N/A'}</div>
                    <div className="text-sm text-gray-500">
                        {record.closingRegNo && `Reg: ${record.closingRegNo}`}
                    </div>
                    <div className="text-sm text-gray-500">
                        {record.closingFatherName && `S/o: ${record.closingFatherName}`}
                    </div>
                </div>
            ),
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            width: 120,
            render: (amount) => (
                <span className="font-bold">₹{amount?.toLocaleString('en-IN') || '0'}</span>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: getStatusTag,
        },
        {
            title: 'Closing Date',
            dataIndex: 'marriageDate',
            key: 'marriageDate',
            width: 150,
            render: (date) => (
                <span>{date}</span>
            ),
        },
    ];

    // Export to PDF function
    const getFileName = () => {
        const agentName = agentInfo?.displayName?.replace(/\s+/g, '_') || 'Agent';
        const programName = selectedProgram?.name?.replace(/\s+/g, '_') || 'Program';
        const date = dayjs().format('DDMMYYYY');
        const memberCount = selectionMode === 'all' ? filteredData.length : selectedMembers.length;
        return `${agentName}_Payment_Report_${programName}_${memberCount}Members_${date}.pdf`;
    };

    return (
        <div className="p-4 space-y-6">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Member Payment Status</h1>
                    <p className="text-gray-600">
                        Agent: <span className="font-semibold">{agentInfo?.displayName || 'N/A'}</span> | 
                        Program: <span className="font-semibold">{selectedProgram?.name || 'N/A'}</span>
                    </p>
                </div>
                <Space>
                   <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      
                        <Radio.Group 
                            value={selectionMode} 
                            onChange={(e) => {
                                setSelectionMode(e.target.value);
                                if (e.target.value === 'all') {
                                    setSelectedMembers([]);
                                    setSelectAll(false);
                                }
                            }}
                            optionType="button"
                            buttonStyle="solid"
                        >
                            <Radio.Button value="all">All Members ({filteredData.length})</Radio.Button>
                            <Radio.Button value="custom">Custom Selection</Radio.Button>
                        </Radio.Group>
                    </div>
                    
                   
                </div>
                
                    <Select
                                              placeholder="Select Program/Yojana"
                                              size="large"
                                              className="w-[200px]"
                                              onChange={handleProgramSelect}
                                              value={selectedProgram ? selectedProgram.id : undefined}
                                            >
                                              {programList.map(program => (
                                                <Option key={program.id} value={program.id}>
                                                  {program.name}
                                                </Option>
                                              ))}
                                            </Select>
                    <Button 
                        type="primary" 
                        icon={<DownloadOutlined />} 
                        size="large"
                        loading={loading}
                        onClick={() => setOpen(true)}
                        disabled={filteredData.length === 0}
                    >
                        Generate PDF
                    </Button>
                    
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={loadAgentPaymentData}
                        loading={loading}
                        size="large"
                    >
                        Refresh
                    </Button>
                </Space>
            </div>

            {/* Summary Cards */}
            <Row gutter={[16, 16]}>
                <Col span={4}>
                    <Card className="shadow-sm">
                        <Statistic
                            title="Total Members"
                            value={summary.totalMembers}
                            valueStyle={{ color: '#1890ff' }}
                            prefix={<UserOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card className="shadow-sm">
                        <Statistic
                            title="Pending Payments"
                            value={summary.totalPending}
                            valueStyle={{ color: '#fa8c16' }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={4}>
                    <Card className="shadow-sm">
                        <Statistic
                            title="Paid Payments"
                            value={summary.totalPaid}
                            valueStyle={{ color: '#52c41a' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="shadow-sm">
                        <Statistic
                            title="Total Pending Amount"
                            value={summary.totalPendingAmount}
                            valueStyle={{ color: '#f5222d' }}
                            prefix={<MoneyCollectOutlined />}
                            formatter={value => `₹${value?.toLocaleString('en-IN')}`}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card className="shadow-sm">
                        <Statistic
                            title="Total Paid Amount"
                            value={summary.totalPaidAmount}
                            valueStyle={{ color: '#389e0d' }}
                            prefix={<MoneyCollectOutlined />}
                            formatter={value => `₹${value?.toLocaleString('en-IN')}`}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters Section */}
            <Card className="shadow-sm">
                <div className="flex flex-wrap gap-4 items-center mb-4">
                    <div className="flex-1 min-w-[300px]">
                        <Search
                            placeholder="Search by name, phone, registration, closing member..."
                            allowClear
                            size="large"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            prefix={<SearchOutlined />}
                        />
                    </div>
                    
                    <div className="w-64">
                        <RangePicker
                            size="large"
                            placeholder={['Start Date', 'End Date']}
                            value={dateRange}
                            onChange={setDateRange}
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                        />
                    </div>
                    
                    <div className="w-40">
                        <Select
                            placeholder="Status Filter"
                            size="large"
                            value={statusFilter}
                            onChange={setStatusFilter}
                            style={{ width: '100%' }}
                        >
                            <Option value="all">All Status</Option>
                            <Option value="pending">Pending Only</Option>
                            <Option value="paid">Paid Only</Option>
                        </Select>
                    </div>
                    
                    <Button
                        icon={<FilterOutlined />}
                        onClick={resetFilters}
                        size="large"
                    >
                        Reset Filters
                    </Button>
                </div>
                <div className='flex items-center gap-2'>

                <div className="text-gray-600 text-sm">
                    Showing {filteredData.length} of {reportData.length} members • 
                    Total Pending: {summary.totalPending} • 
                    Total Paid: {summary.totalPaid} • 
                    Total Amount: ₹{summary.totalAmount?.toLocaleString('en-IN')}
                </div>
                 {selectionMode === 'custom' && (
                        <>
                            <Divider type="vertical" />
                            <Checkbox 
                                checked={selectAll}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                indeterminate={selectedMembers.length > 0 && selectedMembers.length < filteredData.length}
                            >
                                Select All ({selectedMembers.length}/{filteredData.length} selected)
                            </Checkbox>
                        </>
                    )}
                </div>
            </Card>


            {/* Main Table with Row Selection */}
            <Card className="shadow-sm" bodyStyle={{ padding: 0 }}>
                <Table
                    rowSelection={selectionMode === 'custom' ? rowSelection : undefined}
                    columns={columns}
                    dataSource={filteredData}
                    loading={loading}
                    rowKey="memberId"
                    scroll={{ x: 1300,y: 500 }}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => 
                            `${range[0]}-${range[1]} of ${total} members`,
                    }}
                    expandable={{
                        expandedRowRender: (record) => (
                            <div className="p-4 bg-gray-50 rounded">
                                <h4 className="font-semibold mb-3">Marriage Payment Details</h4>
                                <Table
                                    columns={marriageColumns}
                                    dataSource={record.marriages}
                                    rowKey="paymentId"
                                    pagination={false}
                                    size="small"
                                    bordered
                                />
                                <div className="mt-3 text-right">
                                    <span className="font-medium mr-4">
                                        Pending Total: <span className="text-orange-600 font-bold">
                                            ₹{record.marriages
                                                .filter(m => m.status === 'pending')
                                                .reduce((sum, m) => sum + (m.amount || 0), 0)
                                                .toLocaleString('en-IN')}
                                        </span>
                                    </span>
                                    <span className="font-medium">
                                        Paid Total: <span className="text-green-600 font-bold">
                                            ₹{record.marriages
                                                .filter(m => m.status === 'paid')
                                                .reduce((sum, m) => sum + (m.amount || 0), 0)
                                                .toLocaleString('en-IN')}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ),
                        rowExpandable: (record) => record.marriages?.length > 0,
                    }}
                />
            </Card>

            {/* Member Details Modal */}
            <Modal
                title="Member Payment Details"
                open={isDetailsModalVisible}
                onCancel={() => setIsDetailsModalVisible(false)}
                width={800}
                footer={[
                    <Button key="close" onClick={() => setIsDetailsModalVisible(false)}>
                        Close
                    </Button>
                ]}
            >
                {selectedMember && (
                    <div className="space-y-6">
                        {/* Member Info */}
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                            <Avatar 
                                src={selectedMember.photoURL} 
                                size={80} 
                                icon={!selectedMember.photoURL && <UserOutlined />}
                            />
                            <div>
                                <h3 className="text-xl font-bold">{selectedMember.displayName} {selectedMember.surname}</h3>
                                <div className="space-y-1 text-gray-600">
                                    <div><strong>Registration:</strong> {selectedMember.registrationNumber}</div>
                                    <div><strong>Father:</strong> {selectedMember.fatherName}</div>
                                    <div><strong>Phone:</strong> {selectedMember.phone}</div>
                                    <div><strong>Village:</strong> {selectedMember.village}</div>
                                    <div><strong>District:</strong> {selectedMember.district}</div>
                                    <div><strong>Added By:</strong> {selectedMember.addedByName}</div>
                                    <div><strong>Join Date:</strong> {selectedMember.dateJoin}</div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div className="grid grid-cols-4 gap-4">
                            <Card size="small">
                                <Statistic
                                    title="Total Marriages"
                                    value={selectedMember.marriages?.length || 0}
                                />
                            </Card>
                            <Card size="small">
                                <Statistic
                                    title="Pending"
                                    value={selectedMember.marriages?.filter(m => m.status === 'pending').length || 0}
                                    valueStyle={{ color: '#fa8c16' }}
                                />
                            </Card>
                            <Card size="small">
                                <Statistic
                                    title="Paid"
                                    value={selectedMember.marriages?.filter(m => m.status === 'paid').length || 0}
                                    valueStyle={{ color: '#52c41a' }}
                                />
                            </Card>
                            <Card size="small">
                                <Statistic
                                    title="Total Amount"
                                    value={selectedMember.marriages?.reduce((sum, m) => sum + (m.amount || 0), 0) || 0}
                                    valueStyle={{ color: '#1890ff' }}
                                    formatter={value => `₹${value?.toLocaleString('en-IN')}`}
                                />
                            </Card>
                        </div>

                        {/* Marriage Details Table */}
                        <div>
                            <h4 className="font-semibold mb-3">Marriage Payment Details</h4>
                            <Table
                                columns={marriageColumns}
                                dataSource={selectedMember.marriages || []}
                                rowKey="paymentId"
                                pagination={false}
                                bordered
                                size="small"
                            />
                        </div>
                    </div>
                )}
            </Modal>
            
            {/* PDF Drawer */}
            <Drawer
                title={getFileName()}
                width={800}
                placement="right"
                onClose={() => setOpen(false)}
                open={open}
                maskClosable={false}
                destroyOnHidden={true}
                keyboard={false}
                footer={
                    <Space style={{ float: 'right' }}>
                        <Button onClick={() => setOpen(false)} size="large">
                            Cancel
                        </Button>
                        <PDFDownloadLink
                            document={
                                <PaymentReportPDF
                                    data={selectionMode === 'all' ? filteredData : filteredData.filter(m => selectedMembers.includes(m.memberId))}
                                    summary={summary}
                                    agentInfo={agentInfo}
                                    programInfo={selectedProgram}
                                    filters={{
                                        searchText,
                                        dateRange,
                                        statusFilter
                                    }}
                                    selectionMode={selectionMode}
                                    selectedCount={selectionMode === 'all' ? filteredData.length : selectedMembers.length}
                                />
                            }
                            fileName={getFileName()}
                        >
                            {({ loading }) => (
                                <Button 
                                    type="primary" 
                                    icon={<DownloadOutlined />} 
                                    size="large"
                                    loading={loading}
                                    disabled={selectionMode === 'custom' && selectedMembers.length === 0}
                                >
                                    Download PDF ({selectionMode === 'all' ? filteredData.length : selectedMembers.length} members)
                                </Button>
                            )}
                        </PDFDownloadLink>
                    </Space>
                }
            >
                <PDFViewer style={{ width: '100%', height: '100vh', border: 'none' }}>
                    <PaymentReportPDF
                        data={selectionMode === 'all' ? filteredData : filteredData.filter(m => selectedMembers.includes(m.memberId))}
                        summary={summary}
                        agentInfo={agentInfo}
                        programInfo={selectedProgram}
                        filters={{
                            searchText,
                            dateRange,
                            statusFilter
                        }}
                        selectionMode={selectionMode}
                        selectedCount={selectionMode === 'all' ? filteredData.length : selectedMembers.length}
                    />
                </PDFViewer>
            </Drawer>
        </div>
    );
};

export default MemberPayStatus;