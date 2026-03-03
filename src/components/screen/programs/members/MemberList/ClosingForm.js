import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Upload,
  DatePicker,
  Button,
  message,
  Spin,
  Card,
  Row,
  Col,
  Divider,
  Progress,
  Typography,
  Space,
  Alert,
  Tag,
  Badge,
  Tabs
} from 'antd';
import { 
  UploadOutlined, 
  CloseOutlined, 
  CheckOutlined,
  UserOutlined,
  CalendarOutlined,
  FileImageOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  writeBatch,
  getDocs,
  query,
  where, 
  getDoc,
  setDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '@/lib/firebase';
import { updateCounts } from '@/lib/helper';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const ClosingForm = ({ open, onClose, memberData, user, selectedProgram, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [creatingPayments, setCreatingPayments] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [processedMembers, setProcessedMembers] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [existingPaymentCount, setExistingPaymentCount] = useState(0);
  const [existingData, setExistingData] = useState(null);
  const [activeTab, setActiveTab] = useState('close');

  // Check if member already has marriage closed
  useEffect(() => {
    const checkExistingMarriage = async () => {
      if (!memberData || !user || !selectedProgram) return;
      
      try {
        // Check if marriage_flag is true
        if (memberData.marriage_flag) {
          setIsEditMode(true);
          setExistingData({
            marriage_date: memberData.closing_date,
            closingNotes: memberData.closingNotes || '',
            invitationCardURL: memberData.invitationCardURL || ''
          });
          
          // Set existing image URL if available
          if (memberData.invitationCardURL) {
            setExistingImageUrl(memberData.invitationCardURL);
          }
          
          // Check if payment entries already exist
          const paymentPendingRef = collection(
            db,
            `users/${user.uid}/programs/${selectedProgram.id}/payment_pending`
          );
          
          const paymentQuery = query(
            paymentPendingRef,
            where('closingMemberId', '==', memberData.id)
          );
          
          const paymentSnapshot = await getDocs(paymentQuery);
          setExistingPaymentCount(paymentSnapshot.size);
        } else {
          setIsEditMode(false);
          setExistingData(null);
          setExistingImageUrl(null);
        }
      } catch (error) {
        console.error('Error checking existing marriage:', error);
      }
    };
    
    if (open) {
      checkExistingMarriage();
    }
  }, [open, memberData, user, selectedProgram]);

  // Handle form submission
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      let invitationCardURL = existingImageUrl || '';
      
      // Upload new image if exists
      if (imageFile) {
        // Delete old image if exists in edit mode
        if (isEditMode && existingImageUrl) {
          try {
            await deleteOldImage(existingImageUrl);
          } catch (error) {
            console.warn('Could not delete old image:', error);
          }
        }
        
        invitationCardURL = await uploadInvitationCard(imageFile);
      }
      
      const marriageDate = values.marriageDate; // यहाँ से लें
    const currentDate = dayjs().format('DD-MM-YYYY');
      const updateData = { 
        marriage_flag: true,
        closing_date: marriageDate.format('DD-MM-YYYY'),
        marriage_date:marriageDate.format('DD-MM-YYYY'),
        closing_date_query: marriageDate.format('YYYY-MM-DD'),
        closing_datetime: marriageDate.toISOString(),
        closingAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(invitationCardURL && { invitationCardURL }),
        ...(values.notes && { closingNotes: values.notes })
      };

      // Update Firestore document
      const memberRef = doc(
        db, 
        `users/${user.uid}/programs/${selectedProgram?.id}/members`, 
        memberData.id
      );
      
      await updateDoc(memberRef, updateData);
      // Create payment entries only if not in edit mode (first time closing)
      if (!isEditMode) {
        await updateCounts(user.uid, selectedProgram?.id, memberData.agentId, Number(-1))
        setCreatingPayments(true);
        setPaymentProgress(0);
        setProcessedMembers(0);
      }
      
      message.success(isEditMode ? 'Marriage details updated successfully!' : 'Marriage case closed successfully!');
      
      // Reset form and close
      form.resetFields();
      setImageFile(null);
      setImagePreview(null);
      setPaymentProgress(0);
      setProcessedMembers(0);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error closing marriage case:', error);
      message.error('Failed to close marriage case: ' + error.message);
    } finally {
      setLoading(false);
      setCreatingPayments(false);
    }
  };

  const createPaymentPendingEntries = async (closingMemberId, programId, userId) => {
    try {
      setCreatingPayments(true);
      setPaymentProgress(0);
      setProcessedMembers(0);
      
      // Get ALL accepted members from the program EXCEPT the closing member
      const membersCollectionRef = collection(
        db, 
        `users/${userId}/programs/${programId}/members`
      );
      
      // Query for accepted members (status == 'accepted')
      const acceptedQuery = query(
        membersCollectionRef,
        where('status', '==', 'accepted')
      );
      
      const acceptedSnapshot = await getDocs(acceptedQuery);
      let acceptedMembers = acceptedSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(member => member.id !== closingMemberId); // Exclude the closing member
      
      // Get the closing member's data for reference
      const closingMemberRef = doc(db, `users/${userId}/programs/${programId}/members`, closingMemberId);
      const closingMemberSnap = await getDoc(closingMemberRef);
      const closingMemberData = closingMemberSnap.exists() ? {
        id: closingMemberSnap.id,
        ...closingMemberSnap.data()
      } : null;
      
      const total = acceptedMembers.length;
      setTotalMembers(total);
      
      if (total === 0) {
        message.info('No other accepted members found to create payment entries.');
        return;
      }
      
      // Create batch for bulk write
      const batch = writeBatch(db);
      let processed = 0;
      
      // Process members in chunks
      const chunkSize = 300;
      const chunks = [];
      
      for (let i = 0; i < total; i += chunkSize) {
        chunks.push(acceptedMembers.slice(i, i + chunkSize));
      }
      
      for (const [chunkIndex, chunk] of chunks.entries()) {
        for (const member of chunk) {
          const paymentId = `${closingMemberId}_${member.id}`;
          const paymentPendingRef = doc(
            db,
            `users/${userId}/programs/${programId}/payment_pending`,
            paymentId
          );
          
          // Determine payAmount: 200 for all members
          const payAmount = member?.payAmount || 200;
          
          // Prepare payment data
          const paymentData = {
            closingMemberId: closingMemberId,
            memberId: member.id,
            memberDetails: {
              displayName: member.displayName || member.name || 'N/A',
              registrationNumber: member.registrationNumber || 'N/A',
              fatherName: member.fatherName || 'N/A',
              photoURL: member.photoURL || '',
              phone: member.phone || member.phoneNo || 'N/A',
              dateJoin: member.dateJoin || member.createdAt || 'N/A',
              village: member.village || 'N/A',
              district: member.district || 'N/A',
              addedByName: member.addedByName || 'N/A',
              agentId: member.agentId,
              currentStatus: member.status || 'N/A'
            },
            status: 'pending',
            payAmount: payAmount,
            programId: programId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            delete_flag: false,
            dueDate: dayjs().add(30, 'days').format('DD-MM-YYYY'),
            isClosingMember: false,
            paymentFor: closingMemberData?.displayName || 'Marriage Case',
            notes: `Payment for ${closingMemberData?.displayName || 'member'}'s marriage`,
            paymentType: 'contribution'
          };
          
          batch.set(paymentPendingRef, paymentData);
          
          processed++;
          setProcessedMembers(processed);
          setPaymentProgress(Math.round((processed / total) * 100));
        }
        
        // Commit this chunk
        await batch.commit();
        
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Show summary
      const closingMemberName = closingMemberData?.displayName || closingMemberData?.name || 'the member';
      
      message.success({
        content: (
          <div>
            <div>✅ Payment entries created successfully!</div>
            <div className="mt-1">Total: <strong>{total}</strong> payment entries created</div>
            <div className="mt-1">Closing member: <strong>{closingMemberName}</strong></div>
            <div className="mt-1">Total expected collection: <strong>₹{total * 200}</strong></div>
          </div>
        ),
        duration: 5,
      });
      
    } catch (error) {
      console.error('Error creating payment pending entries:', error);
      message.error('Failed to create payment entries: ' + error.message);
      throw error;
    } finally {
      setCreatingPayments(false);
    }
  };

  // Upload invitation card to Firebase Storage
  const uploadInvitationCard = async (file) => {
    try {
      setUploading(true);
      
      const fileExtension = file.name.split('.').pop();
      const fileName = `invitation_${memberData.id}_${uuidv4()}.${fileExtension}`;
      
      const storageRef = ref(
        storage, 
        `users/${user.uid}/programs/${selectedProgram?.id}/members/${memberData.id}/invitation_cards/${fileName}`
      );
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      message.success('Invitation card uploaded!');
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading invitation card:', error);
      message.error('Failed to upload invitation card');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  // Delete old image from storage
  const deleteOldImage = async (imageUrl) => {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.warn('Error deleting old image:', error);
      // Don't throw error here, just log it
    }
  };

  // Handle file selection
  const handleFileChange = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('Only image files allowed!');
      return false;
    }
    
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Image must be smaller than 5MB!');
      return false;
    }
    
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    
    return false;
  };

  // Remove uploaded image
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    // Don't clear existingImageUrl in edit mode
  };

  // Remove existing image
  const handleRemoveExistingImage = () => {
    setExistingImageUrl(null);
    // Also remove from form data
    form.setFieldsValue({ invitationCard: null });
  };

  // Custom upload props
  const uploadProps = {
    beforeUpload: handleFileChange,
    maxCount: 1,
    showUploadList: false,
    accept: 'image/*'
  };

  // Handle drawer close
  const handleClose = () => {
    if (!creatingPayments) {
      form.resetFields();
      setImageFile(null);
      setImagePreview(null);
      setPaymentProgress(0);
      setProcessedMembers(0);
      setIsEditMode(false);
      setExistingData(null);
      setExistingImageUrl(null);
      setActiveTab('close');
      onClose();
    }
  };

  // Validate marriage date
  const validateMarriageDate = (_, value) => {
    if (!value) {
      return Promise.reject(new Error('Please select marriage date!'));
    }
    
    const selectedDate = value.startOf('day');
    const today = dayjs().startOf('day');
    
    if (isEditMode) {
      // In edit mode, allow past dates
      return Promise.resolve();
    }
    
    if (selectedDate.isBefore(today)) {
      return Promise.reject(new Error('Marriage date must be today or in the future!'));
    }
    
    const maxDate = dayjs().add(2, 'year').endOf('day');
    if (selectedDate.isAfter(maxDate)) {
      return Promise.reject(new Error('Marriage date cannot be more than 2 years from now!'));
    }
    
    return Promise.resolve();
  };

  // Disable dates for marriage date
  const disableMarriageDate = (current) => {
    if (isEditMode) return false; // Allow all dates in edit mode
    return current && current < dayjs().startOf('day');
  };

  // Initialize form with existing data
  useEffect(() => {
    if (existingData && open) {
      form.setFieldsValue({
        marriageDate: existingData.marriage_date ? dayjs(existingData.marriage_date, 'DD-MM-YYYY') : null,
        notes: existingData.closingNotes || ''
      });
    }
  }, [existingData, form, open]);

  return (
    <Drawer
      title={
        <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '16px', fontWeight: 600 }}>
              {isEditMode ? 'Edit Marriage Details' : 'Close Marriage Case'}
            </span>
     
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {isEditMode ? 'Update marriage completion details' : 'Record marriage completion details'}
          </Text>
        </Space>
      }
      open={open}
      onClose={handleClose}
      width={520}
      destroyOnClose
      closable={!creatingPayments}
      maskClosable={!creatingPayments}
      extra={
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={handleClose}
          disabled={creatingPayments}
        />
      }
      footer={
        creatingPayments ? null : (
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={loading}
                icon={isEditMode ? <EditOutlined /> : <CheckOutlined />}
                disabled={uploading}
              >
                {isEditMode ? 'Update Details' : 'Confirm & Close'}
              </Button>
            </Space>
          </div>
        )
      }
    >
      <Spin spinning={loading && !creatingPayments}>
        <div style={{ height: 'calc(100vh - 180px)', overflowY: 'auto', paddingRight: '8px' }}>
          {/* Member Summary */}
          <Card size="small" className="mb-3" bodyStyle={{ padding: '12px' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <UserOutlined className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <Text strong ellipsis style={{ maxWidth: '200px' }}>
                    {memberData?.displayName || 'N/A'}
                  </Text>
                  <Tag color={isEditMode ? "green" : "blue"} style={{ margin: 0 }}>
                    {isEditMode ? "Marriage Closed" : memberData?.ageGroupRange || 'N/A'}
                  </Tag>
                </div>
                <Paragraph type="secondary" style={{ fontSize: '12px', marginBottom: '4px' }}>
                  Reg: {memberData?.registrationNumber || 'N/A'}
                  {existingData && (
                    <span className="ml-2 text-green-600">
                      <CheckOutlined className="mr-1" />
                      Marriage recorded on {existingData.marriage_date}
                    </span>
                  )}
                </Paragraph>
                {isEditMode && existingPaymentCount > 0 && (
                  <Alert
                    message={`${existingPaymentCount} payment entries already created`}
                    type="info"
                    showIcon
                    icon={<DollarOutlined />}
                    className="mb-2"
                    size="small"
                  />
                )}
                <div style={{ fontSize: '12px' }}>
                  <Row gutter={[8, 4]}>
                    <Col span={12}>
                      <Text type="secondary">Father:</Text>
                      <div className="truncate">
                        <Text strong>{memberData?.fatherName || 'N/A'}</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Phone:</Text>
                      <div className="truncate">
                        <Text strong>{memberData?.phone || 'N/A'}</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Program:</Text>
                      <div className="truncate">
                        <Text strong>{selectedProgram?.name || 'N/A'}</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">Location:</Text>
                      <div className="truncate">
                        <Text strong>{memberData?.village || 'N/A'}, {memberData?.district || 'N/A'}</Text>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            </div>
          </Card>


          {/* Payment Creation Progress */}
          {creatingPayments && (
            <Card 
              size="small" 
              className="mb-3" 
              bodyStyle={{ padding: '12px' }}
              style={{ borderColor: '#1890ff', background: '#e6f7ff' }}
            >
              <div className="flex items-start gap-3">
                <DollarOutlined className="text-blue-600 mt-1" style={{ fontSize: '16px' }} />
                <div className="flex-1">
                  <Text strong style={{ fontSize: '13px' }}>Creating Payment Entries</Text>
                  <Progress 
                    percent={paymentProgress} 
                    status="active"
                    size="small"
                    style={{ margin: '8px 0' }}
                  />
                  <Row justify="space-between" style={{ fontSize: '12px' }}>
                    <Col>
                      <Text type="secondary">
                        Processed: <Text strong>{processedMembers}</Text> of <Text strong>{totalMembers}</Text>
                      </Text>
                    </Col>
                    <Col>
                      <Text strong>{paymentProgress}%</Text>
                    </Col>
                  </Row>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
                    Creating payment entries for other accepted members. This will complete automatically.
                  </Text>
                </div>
              </div>
            </Card>
          )}

   

          {/* Closing Form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="small"
            disabled={creatingPayments}
          >
            {/* Marriage Date Only */}
            <Form.Item
              label={
                <span>
                  <CalendarOutlined className="mr-1 text-gray-400" />
                Closing date 
                  <span className="text-red-500 ml-1">*</span>
                </span>
              }
              name="marriageDate"
              rules={[
                { required: true, message: 'Please select marriage date!' },
                // { validator: validateMarriageDate }
              ]}

            >
              <DatePicker
                format="DD-MM-YYYY"
                className="w-full"
                placeholder="Select marriage date"
                size="small"  
              />
            </Form.Item>

            {/* Invitation Card Upload */}
            <Form.Item
              label={
                <span>
                  <FileImageOutlined className="mr-1 text-gray-400" />
                  Wedding Invitation Card
                  {!isEditMode && <span className="text-red-500 ml-1">*</span>}
                </span>
              }
              name="invitationCard"
              rules={[
                { 
                  required: !isEditMode, 
                  message: 'Please upload invitation card!' 
                }
              ]}
              extra="Upload wedding invitation as proof (max 5MB)"
            >
              <div className="space-y-2">
                {/* Show existing image in edit mode */}
                {isEditMode && existingImageUrl && !imagePreview && (
                  <div className="border rounded p-2 bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <p className="text-xs font-medium text-blue-600 flex items-center">
                          <EyeOutlined className="mr-1" />
                          Existing invitation card
                        </p>
                        <p className="text-xs text-gray-500 truncate" style={{ maxWidth: '200px' }}>
                          Current file
                        </p>
                      </div>
                      <Space>
                        <Button
                          type="text"
                          size="small"
                          className="text-xs p-1"
                          onClick={() => window.open(existingImageUrl, '_blank')}
                        >
                          View
                        </Button>
                        <Button
                          type="text"
                          size="small"
                          danger
                          onClick={handleRemoveExistingImage}
                          className="text-xs p-1"
                        >
                          Remove
                        </Button>
                      </Space>
                    </div>
                    <div className="border rounded overflow-hidden bg-white">
                      <img 
                        src={existingImageUrl} 
                        alt="Existing invitation" 
                        style={{ width: '100%', height: '100px', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload new image */}
                {!imagePreview && !(isEditMode && existingImageUrl) ? (
                  <Upload.Dragger
                    {...uploadProps}
                    className="border-dashed border-gray-300 hover:border-blue-400 rounded"
                  >
                    <div className="p-2">
                      <UploadOutlined className="text-lg text-gray-400 mb-1" />
                      <p className="text-xs font-medium mb-0.5">
                        {isEditMode ? 'Upload new invitation card' : 'Upload invitation card'}
                      </p>
                      <p className="text-xs text-gray-500">Click or drag image here</p>
                    </div>
                  </Upload.Dragger>
                ) : imagePreview ? (
                  <div className="border rounded p-2 bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <p className="text-xs font-medium text-green-600 flex items-center">
                          <CheckOutlined className="mr-1" />
                          {isEditMode ? 'New file uploaded' : 'File uploaded'}
                        </p>
                        <p className="text-xs text-gray-500 truncate" style={{ maxWidth: '200px' }}>
                          {imageFile.name}
                        </p>
                      </div>
                      <Button
                        type="text"
                        size="small"
                        danger
                        onClick={handleRemoveImage}
                        className="text-xs p-1"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="border rounded overflow-hidden bg-white">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100px', objectFit: 'contain' }}
                        onLoad={() => URL.revokeObjectURL(imagePreview)}
                      />
                    </div>
                  </div>
                ) : null}
                
                {uploading && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Spin size="small" />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            </Form.Item>

            {/* Additional Notes */}
            <Form.Item
              label="Additional Notes (Optional)"
              name="notes"
            >
              <Input.TextArea
                rows={2}
                placeholder="Add any remarks or notes..."
                maxLength={200}
                showCount
                size="small"
              />
            </Form.Item>
          </Form>
        </div>
      </Spin>
    </Drawer>
  );
};

export default ClosingForm;