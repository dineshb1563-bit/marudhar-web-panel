"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ClientSideRowModelModule,
  ModuleRegistry,
  NumberFilterModule,
  PaginationModule,
  RowSelectionModule,
  TextFilterModule,
  RowStyleModule,
} from 'ag-grid-community';
import { useSelector } from 'react-redux';
import { useAuth } from '@/lib/AuthProvider';
import { deleteData, getData, updateData } from '@/lib/services/firebaseService';
import { 
  Button, 
  Space, 
  Modal, 
  message, 
  App, 
  Card, 
  Row, 
  Col, 
  DatePicker,
  Select,
  Input,
  Tag,
  Popconfirm,
  Tooltip,
  Divider,
  Typography,
  Alert
} from 'antd';
import { 
  DeleteOutlined, 
  EyeOutlined, 
  DownloadOutlined,
  ReloadOutlined,
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  CreditCardOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

// Dynamically import AddPaymentModal with no SSR
import dynamic from 'next/dynamic';

const AddPaymentModal = dynamic(() => import('@/components/common/addPayment/AddPaymentModal'), {
  ssr: false,
  loading: () => <Button type="primary" loading>Add Payment</Button>
});

// Extend dayjs with isBetween plugin
dayjs.extend(isBetween);

ModuleRegistry.registerModules([
  TextFilterModule,
  NumberFilterModule,
  RowSelectionModule,
  PaginationModule,
  ClientSideRowModelModule,
  RowStyleModule
]);

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;
const { Text } = Typography;

const TransactionsPage = () => {
  const { user } = useAuth();
  // Get modal and message from App.useApp()
  const { message: antdMessage, modal } = App.useApp();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const selectedProgram = useSelector((state) => state.data.selectedProgram);
  const gridRef = useRef();
  
  // Store program ID in ref to ensure it's available during async operations
  const programRef = useRef(selectedProgram);
  
  // Filter states
  const [dateRange, setDateRange] = useState(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  
  // Modal states
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Summary stats
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalTransactions: 0
  });

  // Update ref when selectedProgram changes
  useEffect(() => {
    programRef.current = selectedProgram;
  }, [selectedProgram]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!user) {
      antdMessage.error('User not authenticated');
      return;
    }
    
    const currentProgram = programRef.current;
    if (!currentProgram) {
      // Don't show error, just clear data
      setTransactions([]);
      setSummary({ totalAmount: 0, totalTransactions: 0 });
      return;
    }

    setLoading(true);
    try {
      const data = await getData(
        `/users/${user.uid}/programs/${currentProgram.id}/transactions`,
        [
          { field: 'active_flag', operator: '==', value: true },
          { field: 'delete_flag', operator: '==', value: false }
        ],
        { field: 'createdAt', direction: 'desc' }
      );
      
      setTransactions(data);
      calculateSummary(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      antdMessage.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [user, antdMessage]);

  // Calculate summary statistics
  const calculateSummary = (data) => {
    const totalAmount = data.reduce((sum, t) => sum + (t.amount || 0), 0);

    setSummary({
      totalAmount,
      totalTransactions: data.length
    });
  };

  // Show delete confirmation modal using modal from App.useApp()
  const showDeleteConfirm = (transaction) => {
    // Check if program exists before showing modal
    const currentProgram = programRef.current;
    if (!currentProgram) {
      antdMessage.error('No program selected. Please select a program first.');
      return;
    }

    modal.confirm({
      title: 'Delete Transaction',
      icon: <ExclamationCircleOutlined className="text-red-500" />,
      content: (
        <div className="space-y-3">
          <Alert
            message="Warning"
            description="This action cannot be undone. The transaction will be permanently deleted."
            type="warning"
            showIcon
            className="mb-3"
          />
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium mb-2">Transaction Details:</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction ID:</span>
                <span className="font-mono font-medium">{transaction.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-bold text-green-600">₹{transaction.amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payer:</span>
                <span>{transaction.payerName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Beneficiary:</span>
                <span>{transaction.marriageMemberName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span>{transaction.paymentDate ? dayjs(transaction.paymentDate).format('DD/MM/YYYY') : '-'}</span>
              </div>
            </div>
          </div>
          {transaction.paymentPendingId && (
            <Alert
              message="Pending Payment Impact"
              description="This transaction is linked to a pending payment. Deleting it will revert the pending payment status to 'pending'."
              type="info"
              showIcon
            />
          )}
        </div>
      ),
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No, Cancel',
      okButtonProps: { 
        loading: deleteLoading,
        className: 'bg-red-500 hover:bg-red-600'
      },
      onOk: async () => {
        await handleDelete(transaction);
      },
      onCancel() {
        console.log('Delete cancelled');
      },
    });
  };

  // Delete transaction
  const handleDelete = async (transaction) => {
    // Check authentication
    if (!user) {
      antdMessage.error('User not authenticated');
      return;
    }

    // Get current program from ref (ensures we have latest value)
    const currentProgram = programRef.current;
    if (!currentProgram) {
      antdMessage.error('No program selected. Please select a program first.');
      return;
    }

    setDeleteLoading(true);
    
    try {
      console.log('Deleting transaction:', transaction.id, 'from program:', currentProgram.id);
      
      // Delete the transaction
      await deleteData(
        `/users/${user.uid}/programs/${currentProgram.id}/transactions`,
        transaction.id
      );

      // Reverse update pending payment entry if exists
      if (transaction.paymentPendingId) {
        try {
          await updateData(
            `/users/${user.uid}/programs/${currentProgram.id}/payment_pending`,
            transaction.paymentPendingId,
            {
              status: 'pending',
              transactionId: null,
              paymentDate: null,
              paidAmount: null,
              paymentMethod: null,
              onlineReference: null,
              updatedAt: dayjs().toISOString(),
              lastDeletedTransactionId: transaction.id,
              lastDeletedAt: dayjs().toISOString()
            }
          );
          
          antdMessage.success({
            content: 'Transaction deleted and pending payment status restored',
            duration: 3
          });
        } catch (pendingError) {
          console.error('Error updating pending payment:', pendingError);
          antdMessage.warning('Transaction deleted but failed to update pending payment status');
        }
      } else {
        antdMessage.success('Transaction deleted successfully');
      }

      // Update local state immediately for better UX
      setTransactions(prev => prev.filter(t => t.id !== transaction.id));
      
      // Refresh data from server to ensure consistency
      await fetchTransactions();
      
      // Close view modal if open
      setViewModalVisible(false);
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      antdMessage.error(`Failed to delete transaction: ${error.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // View transaction details
  const handleView = (transaction) => {
    setSelectedTransaction(transaction);
    setViewModalVisible(true);
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions.length) return [];
    
    return transactions.filter(transaction => {
      // Date filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const transactionDate = dayjs(transaction.paymentDate);
        const startDate = dateRange[0];
        const endDate = dateRange[1];
        
        if (!transactionDate || !startDate || !endDate) {
          return false;
        }
        
        const isWithinRange = transactionDate.isBetween(startDate, endDate, 'day', '[]');
        if (!isWithinRange) {
          return false;
        }
      }

      // Payment method filter
      if (paymentMethodFilter !== 'all' && transaction.paymentMethod !== paymentMethodFilter) {
        return false;
      }

      // Search filter
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const searchFields = [
          transaction.payerName,
          transaction.marriageMemberName,
          transaction.transactionNumber,
          transaction.onlineReference,
          transaction.payerRegistrationNumber,
          transaction.marriageRegistrationNumber
        ];

        return searchFields.some(field => 
          field && field.toString().toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [transactions, dateRange, paymentMethodFilter, searchText]);

  // Export to CSV
  const onExport = useCallback(() => {
    if (!filteredTransactions.length) {
      antdMessage.warning('No data to export');
      return;
    }
    gridRef.current?.api.exportDataAsCsv({
      fileName: `transactions_${selectedProgram?.name || 'all'}_${dayjs().format('YYYY-MM-DD')}.csv`,
    });
  }, [filteredTransactions, selectedProgram, antdMessage]);

  // Column Definitions
  const columnDefs = useMemo(() => [
    {
      headerName: 'TRX ID',
      field: 'transactionNumber',
      width: 140,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellStyle: { fontWeight: '500', fontSize: '12px' },
      cellRenderer: (params) => (
        <Button 
          type="link" 
          onClick={() => handleView(params.data)}
          className="p-0 text-xs text-blue-600 hover:text-blue-800"
        >
          {params.value}
        </Button>
      )
    },
    {
      headerName: 'Date',
      field: 'paymentDate',
      width: 100,
      sortable: true,
      valueFormatter: (params) => params.value ? dayjs(params.value).format('DD/MM/YY') : '-',
      comparator: (dateA, dateB) => {
        const a = dayjs(dateA).unix();
        const b = dayjs(dateB).unix();
        return a - b;
      },
      cellStyle: { fontSize: '12px' }
    },
    {
      headerName: 'Payer',
      field: 'payerName',
      width: 140,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params) => (
        <div className="text-xs">
          <div className="font-medium truncate">{params.data.payerName || '-'}</div>
          <div className="text-gray-500 truncate">
            {params.data.payerRegistrationNumber || '-'}
          </div>
        </div>
      )
    },
    {
      headerName: 'Beneficiary',
      field: 'marriageMemberName',
      width: 140,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params) => (
        <div className="text-xs">
          <div className="font-medium truncate">{params.data.marriageMemberName || '-'}</div>
          <div className="text-gray-500 truncate">
            {params.data.marriageRegistrationNumber || '-'}
          </div>
        </div>
      )
    },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 100,
      sortable: true,
      type: 'rightAligned',
      cellStyle: { 
        fontWeight: 'bold',
        fontSize: '12px',
        color: '#52c41a'
      },
      valueFormatter: (params) => `₹${params.value?.toLocaleString('en-IN') || '0'}`,
      cellClass: 'text-right'
    },
    {
      headerName: 'Method',
      field: 'paymentMethod',
      width: 90,
      sortable: true,
      filter: 'agSetColumnFilter',
      cellRenderer: (params) => {
        const method = params.value;
        const color = method === 'cash' ? 'green' : 'blue';
        return (
          <Tag 
            color={color}
            className="capitalize text-xs"
          >
            {method === 'cash' ? 'Cash' : 'Online'}
          </Tag>
        );
      }
    },
    {
      headerName: 'Reference',
      field: 'onlineReference',
      width: 140,
      cellRenderer: (params) => {
        if (!params.value) return '-';
        return (
          <Tooltip title={params.value}>
            <div className="text-xs font-mono truncate">
              {params.value.length > 15 ? `${params.value.substring(0, 12)}...` : params.value}
            </div>
          </Tooltip>
        );
      }
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 80,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined className="text-xs" />}
              onClick={() => handleView(params.data)}
              size="small"
              className="text-blue-500 hover:text-blue-700 p-1"
            />
          </Tooltip>
          <Tooltip title="Delete Transaction">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined className="text-xs" />}
              onClick={() => {
                // Check if program exists before showing delete confirm
                if (!programRef.current) {
                  antdMessage.error('No program selected. Please select a program first.');
                  return;
                }
                showDeleteConfirm(params.data);
              }}
              size="small"
              className="p-1"
            />
          </Tooltip>
        </Space>
      )
    }
  ], [antdMessage]);

  // Default column definition
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 80,
    cellStyle: { 
      display: 'flex',
      alignItems: 'center',
      padding: '4px 2px'
    },
    headerClass: 'bg-gray-50 font-semibold text-xs',
  }), []);

  // Fetch on program change
  useEffect(() => {
    fetchTransactions();
  }, [selectedProgram, fetchTransactions]);

  // Reset filters
  const resetFilters = () => {
    setDateRange(null);
    setPaymentMethodFilter('all');
    setSearchText('');
  };

  // Handle no program selected
  if (!selectedProgram) {
    return (
      <div className="p-4">
        <Card>
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <DollarOutlined className="text-2xl text-blue-500" />
            </div>
            <Text type="secondary" className="text-lg mb-2">No Program Selected</Text>
            <Text type="secondary" className="text-sm text-center max-w-md">
              Please select a program from the dropdown above to view and manage transactions.
            </Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-2">
      {/* Compact Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Transactions</h2>
            <Text type="secondary" className="text-xs">
              Program: {selectedProgram.name}
            </Text>
          </div>
          <Space>
            <Text className="text-sm text-gray-600">
              Total: <span className="font-semibold">{summary.totalTransactions}</span> | 
              Amount: <span className="font-semibold text-green-600">₹{summary.totalAmount?.toLocaleString('en-IN')}</span>
            </Text>
          </Space>
        </div>
      </div>

      {/* Compact Filters Bar */}
      <Card size="small" className="mb-3 shadow-sm">
        <Row gutter={[8, 8]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <AddPaymentModal onSuccess={fetchTransactions} />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchTransactions}
                loading={loading}
                size="small"
              >
                Refresh
              </Button>
              <Button 
                icon={<DownloadOutlined />} 
                onClick={onExport}
                disabled={!filteredTransactions.length}
                size="small"
              >
                Export
              </Button>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <RangePicker
                size="small"
                placeholder={['From', 'To']}
                format="DD/MM/YY"
                value={dateRange}
                onChange={setDateRange}
                allowClear
                className="w-48"
              />
              <Select
                size="small"
                placeholder="Payment Method"
                value={paymentMethodFilter}
                onChange={setPaymentMethodFilter}
                className="w-32"
              >
                <Option value="all">All</Option>
                <Option value="cash">Cash</Option>
                <Option value="online">Online</Option>
              </Select>
              <Search
                size="small"
                placeholder="Search..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-40"
              />
              <Button 
                size="small" 
                onClick={resetFilters}
                disabled={!dateRange && paymentMethodFilter === 'all' && !searchText}
              >
                Clear
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Table */}
      <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={filteredTransactions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          pagination={true}
          paginationPageSize={50}
          paginationPageSizeSelector={[20, 50, 100]}
          rowSelection="single"
          suppressRowClickSelection={true}
          loading={loading}
          overlayNoRowsTemplate={loading ? 'Loading transactions...' : 'No transactions found'}
          onGridReady={(params) => {
            params.api.sizeColumnsToFit();
          }}
          onFirstDataRendered={(params) => params.api.sizeColumnsToFit()}
          getRowId={(params) => params.data.id}
          rowHeight={45}
          headerHeight={35}
        />
      </div>

      {/* Compact View Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <DollarOutlined className="text-green-500" />
            <span className="text-sm">Transaction Details</span>
          </div>
        }
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedTransaction && (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{selectedTransaction.amount?.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedTransaction.transactionNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Tag color={selectedTransaction.paymentMethod === 'cash' ? 'green' : 'blue'}>
                      {selectedTransaction.paymentMethod === 'cash' ? 'Cash' : 'Online'}
                    </Tag>
                    <Tag color="success">Completed</Tag>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {dayjs(selectedTransaction.paymentDate).format('DD MMM YYYY, h:mm A')}
                  </div>
                </div>
              </div>
            </div>

            <Divider className="my-2" />

            {/* Two Column Details */}
            <Row gutter={16}>
              <Col span={12}>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <UserOutlined className="text-xs" /> Payer Details
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-xs text-gray-500">Name:</span>
                      <div className="font-medium">{selectedTransaction.payerName || '-'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Registration:</span>
                      <div className="text-sm">{selectedTransaction.payerRegistrationNumber || '-'}</div>
                    </div>
                    {selectedTransaction.payerPhone && (
                      <div>
                        <span className="text-xs text-gray-500">Phone:</span>
                        <div className="text-sm">{selectedTransaction.payerPhone}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <UserOutlined className="text-xs" /> Beneficiary Details
                  </div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-xs text-gray-500">Name:</span>
                      <div className="font-medium">{selectedTransaction.marriageMemberName || '-'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Registration:</span>
                      <div className="text-sm">{selectedTransaction.marriageRegistrationNumber || '-'}</div>
                    </div>
                    {selectedTransaction.marriageDate && (
                      <div>
                        <span className="text-xs text-gray-500">Marriage Date:</span>
                        <div className="text-sm">{dayjs(selectedTransaction.marriageDate).format('DD MMM YYYY')}</div>
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            </Row>

            <Divider className="my-2" />

            {/* Additional Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="font-semibold text-gray-600 mb-2">Additional Information</div>
              <div className="space-y-2">
                <div className="flex">
                  <span className="w-24 text-xs text-gray-500">Program:</span>
                  <span className="text-sm font-medium">{selectedTransaction.programName || '-'}</span>
                </div>
                {selectedTransaction.onlineReference && (
                  <div className="flex">
                    <span className="w-24 text-xs text-gray-500">Reference:</span>
                    <span className="text-sm font-mono">{selectedTransaction.onlineReference}</span>
                  </div>
                )}
                {selectedTransaction.note && (
                  <div className="flex">
                    <span className="w-24 text-xs text-gray-500">Note:</span>
                    <span className="text-sm">{selectedTransaction.note}</span>
                  </div>
                )}
                <div className="flex">
                  <span className="w-24 text-xs text-gray-500">Created:</span>
                  <span className="text-sm">{dayjs(selectedTransaction.createdAt).format('DD MMM YYYY')}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button size="middle" onClick={() => setViewModalVisible(false)}>
                Close
              </Button>
              <Button
                size="middle"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setViewModalVisible(false);
                  // Check if program exists before showing delete confirm
                  if (!programRef.current) {
                    antdMessage.error('No program selected. Please select a program first.');
                    return;
                  }
                  showDeleteConfirm(selectedTransaction);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;