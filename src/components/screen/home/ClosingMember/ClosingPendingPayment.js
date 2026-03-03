import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Input,
  Select,
  Avatar,
  Tooltip,
  Badge,
  Typography,
  Empty,
  Statistic,
  Tag,
  Space
} from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  DollarOutlined,
  TeamOutlined,
  ScheduleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthProvider';
import { useSelector } from 'react-redux';

const { Option } = Select;
const { Title, Text } = Typography;

const ClosingPendingPayment = ({ selectedRecord }) => {
  const { user } = useAuth();
  const agentsList = useSelector((state) => state.data.agentsList) || [];
  
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');

  // Fetch payments for the specific closing member
  const fetchPayments = useCallback(async () => {
    if (!selectedRecord?.programId || !user || !selectedRecord?.id) return;

    try {
      setLoading(true);
      const paymentsRef = collection(db, `users/${user.uid}/programs/${selectedRecord.programId}/payment_pending`);
      
      const q = query(paymentsRef, where('closingMemberId', '==', selectedRecord.id));
      const snapshot = await getDocs(q);
      
      const paymentsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const id = docSnap.id;
          const [, memberId] = id.split('_');

          let memberDetails = data.memberDetails || {};

          if (memberId) {
            try {
              const memberRef = doc(db, `users/${user.uid}/programs/${selectedRecord.programId}/members`, memberId);
              const memberSnap = await getDoc(memberRef);
              if (memberSnap.exists()) {
                const memberData = memberSnap.data();
                memberDetails = { ...memberDetails, ...memberData };
              }
            } catch (err) {
              console.error('Error fetching member details:', err);
            }
          }

          const dueDate = data.dueDate ? dayjs(data.dueDate, 'DD-MM-YYYY') : null;
          const isOverdue = dueDate && dueDate.isBefore(dayjs(), 'day');
          const agent = agentsList.find(a => a.id === memberDetails.agentId) || {};

          return {
            id,
            key: id,
            ...data,
            memberDetails: {
              displayName: memberDetails.displayName || data.memberDetails?.displayName || 'Unknown',
              registrationNumber: memberDetails.registrationNumber || data.memberDetails?.registrationNumber || 'N/A',
              phone: memberDetails.phone || data.memberDetails?.phoneNo || 'N/A',
              village: memberDetails.village || data.memberDetails?.village || 'N/A',
              district: memberDetails.district || data.memberDetails?.district || 'N/A',
              agentName: agent.displayName || agent.name || memberDetails.addedByName || 'N/A',
              agentId: memberDetails.agentId,
              photoURL: memberDetails.photoURL || data.memberDetails?.photoURL || ''
            },
            isOverdue,
            dueDateFormatted: dueDate?.format('DD-MM-YYYY') || 'N/A',
            isClosingMember: memberId === selectedRecord.id
          };
        })
      );

      setPayments(paymentsData);
      setFilteredPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedRecord, user, agentsList]);

  // Apply filters
  useEffect(() => {
    let filtered = payments.filter(payment => {
      // Search filter
      const matchesSearch = !searchText || 
        payment.memberDetails.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
        payment.memberDetails.registrationNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        payment.memberDetails.phone.toLowerCase().includes(searchText.toLowerCase());
      
      // Agent filter
      const matchesAgent = agentFilter === 'all' || payment.memberDetails.agentId === agentFilter;
      
      return matchesSearch && matchesAgent;
    });
    
    setFilteredPayments(filtered);
  }, [payments, searchText, agentFilter]);

  // Calculate stats
  const stats = {
    total: filteredPayments.length,
    pending: filteredPayments.filter(p => !p.status || p.status === 'pending').length,
    paid: filteredPayments.filter(p => p.status === 'paid').length,
    overdue: filteredPayments.filter(p => p.isOverdue && (!p.status || p.status === 'pending')).length,
    totalAmount: filteredPayments.reduce((sum, p) => sum + (p.payAmount || 200), 0),
    collectedAmount: filteredPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.payAmount || 200), 0)
  };

  // Table columns
  const columns = [
    {
      title: 'Member',
      key: 'member',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <div className="flex items-center gap-2">
            <Avatar 
              size="small" 
              src={record.memberDetails.photoURL} 
              icon={<UserOutlined />}
              className="bg-blue-100 text-blue-600"
            />
            <div>
              <div className="font-medium text-sm">{record.memberDetails.displayName}</div>
              <div className="text-xs text-gray-500">
                Reg: {record.memberDetails.registrationNumber}
              </div>
            </div>
            {record.isClosingMember && (
              <Tag color="gold" size="small">Self</Tag>
            )}
          </div>
          <div className="text-xs text-gray-500">
            📱 {record.memberDetails.phone} • {record.memberDetails.village}
          </div>
        </Space>
      ),
    },
    {
      title: 'Agent',
      key: 'agent',
      width: 150,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <UserAddOutlined className="text-gray-400" />
          <span className="text-sm">{record.memberDetails.agentName}</span>
        </div>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 100,
      render: (_, record) => (
        <div className="font-bold text-blue-700">₹{record.payAmount || 200}</div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_, record) => {
        const status = record.status || 'pending';
        const color = status === 'paid' ? 'success' : 
                     record.isOverdue ? 'error' : 'warning';
        const icon = status === 'paid' ? <CheckCircleOutlined /> : 
                    record.isOverdue ? <CloseCircleOutlined /> : <ScheduleOutlined />;
        
        return (
          <Badge
            status={color}
            text={
              <Space size={4}>
                {icon}
                <span className="capitalize">{status}</span>
                {record.isOverdue && status === 'pending' && (
                  <Tag color="red" size="small">Overdue</Tag>
                )}
              </Space>
            }
          />
        );
      },
    },
    {
      title: 'Due Date',
      key: 'dueDate',
      width: 120,
      render: (_, record) => (
        <div className="text-sm">{record.dueDateFormatted}</div>
      ),
    },
  ];

  // Fetch data on mount
  useEffect(() => {
    if (selectedRecord) {
      fetchPayments();
    }
  }, [selectedRecord, fetchPayments]);

  if (!selectedRecord) {
    return (
      <Card className="border-0">
        <Empty description="Please select a closing member" />
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Avatar 
            size={48}
            src={selectedRecord?.photoURL}
            icon={<UserOutlined />}
            className="bg-blue-100 border-2 border-blue-200"
          />
          <div>
            <Title level={4} className="m-0">
              <DollarOutlined className="mr-2 text-green-600" />
              {selectedRecord?.displayName}'s Marriage Payments
            </Title>
            <div className="flex flex-wrap gap-2 mt-2">
              <Tag color="blue">Reg: {selectedRecord?.registrationNumber}</Tag>
              <Tag color="green">{selectedRecord?.programName}</Tag>
              <Tag color="orange">Marriage: {selectedRecord?.marriage_date}</Tag>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <Row gutter={16} className="mb-6">
        <Col span={4}>
          <Card size="small" className="text-center">
            <Statistic title="Total" value={stats.total} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="text-center">
            <Statistic title="Pending" value={stats.pending} prefix={<ScheduleOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="text-center">
            <Statistic title="Completed" value={stats.paid} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="text-center">
            <Statistic title="Overdue" value={stats.overdue} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="text-center">
            <Statistic title="Total Amount" value={stats.totalAmount} prefix="₹" />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" className="text-center">
            <Statistic title="Collected" value={stats.collectedAmount} prefix="₹" />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <Row gutter={16}>
          <Col span={12}>
            <Input
              placeholder="Search members..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={12}>
            <Select
              placeholder="Filter by Agent"
              className="w-full"
              value={agentFilter}
              onChange={setAgentFilter}
              allowClear
              showSearch
            >
              <Option value="all">All Agents</Option>
              {agentsList.map(agent => (
                <Option key={agent.id} value={agent.id}>
                  {agent.displayName || agent.name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </div>

      {/* Payment Table */}
      <Card size="small" className="border">
        {filteredPayments.length === 0 ? (
          <Empty description={loading ? "Loading..." : "No payments found"} />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredPayments}
            loading={loading}
            size="small"
            pagination={{ pageSize: 10 }}
            rowKey="id"
          />
        )}
      </Card>

      {/* Summary */}
      {filteredPayments.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex justify-between">
            <Text strong>
              Showing {filteredPayments.length} of {payments.length} payments
            </Text>
            <div className="text-right">
              <Text strong className="text-red-600">
                Pending: ₹{filteredPayments
                  .filter(p => !p.status || p.status === 'pending')
                  .reduce((sum, p) => sum + (p.payAmount || 200), 0)}
              </Text>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ClosingPendingPayment;