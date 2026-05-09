import React, { useState, useEffect } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, Space, Card, Typography, App, Radio, Modal } from 'antd';
import { FiPlusCircle, FiTrash2, FiUser, FiMapPin, FiDollarSign, FiCalendar, FiTag, FiEdit2, FiSave } from 'react-icons/fi';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setgetMemberDataChange, setPrograms } from '@/redux/slices/commonSlice';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@/lib/AuthProvider';

const { TextArea } = Input;
const { Title, Text } = Typography;

const AddProgramEdit = ({ program, mode = 'add', onSuccess, isDrawerOpen, setIsDrawerOpen }) => {
  // Ant Design hooks for high-level components
  const { modal, message: antdMessage } = App.useApp();
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [updatingMembers, setUpdatingMembers] = useState(false);
  
  const dispatch = useDispatch();
  const programList = useSelector((state) => state.data.programList);

  const programCategories = [
    { label: 'Suraksha', value: 'isSuraksha' },
    { label: 'Mamera', value: 'isMamera' },
    { label: 'Vivah', value: 'isVivah' },
    { label: 'Other', value: 'isOther' },
  ];

  // Helper: Check if sensitive fields changed
  const checkAgeGroupsChanged = (oldGroups, newGroups) => {
    if (!oldGroups || oldGroups.length !== newGroups.length) return true;
    return oldGroups.some((oldG, i) => {
      const newG = newGroups[i];
      return oldG.startAge !== newG?.startAge || 
             oldG.endAge !== newG?.endAge || 
             oldG.joinFee !== newG?.joinFee || 
             oldG.payAmount !== newG?.payAmount;
    });
  };

  // API Call for background updates
  const updateMemberFees = async (programId, ageGroups) => {
    try {
      const token = user.tokens.accessToken
      const response = await fetch('/api/update-member-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ programId, userId: user.uid, ageGroups }),
      });
      const result = await response.json();
      return response.ok && result.success;
    } catch (error) {
      console.error('API Error:', error);
      return false;
    }
  };

  useEffect(() => {
    if (isDrawerOpen) {
      if (mode === 'edit' && program) {
        setIsSelected(program.isSelected || false);
        let selectedCategory = 'isOther';
        programCategories.forEach(cat => { if (program[cat.value]) selectedCategory = cat.value; });
        
        form.setFieldsValue({
          ...program,
          category: selectedCategory,
          memberCount: program.memberCount || 0,
          inactivemembercount: program.inactivemembercount || 0,
        });
      } else {
        setIsSelected(false);
        form.resetFields();
      }
    }
  }, [mode, program, isDrawerOpen, form]);

  const handleSubmit = async (values) => {
    if (!user?.uid) return antdMessage.error("Auth error!");
    
    setLoading(true);
    try {
      let shouldUpdateMembers = false;

      // Modal Confirmation Logic
      if (mode === 'edit' && program) {
        const changed = checkAgeGroupsChanged(program.ageGroups || [], values.ageGroups || []);
        if (changed) {
          shouldUpdateMembers = await new Promise((resolve) => {
            modal.confirm({
              title: 'Update Existing Members?',
              content: 'Age groups/fees changed. Update all existing members now?',
              centered: true,
              okText: 'Yes, Update All',
              cancelText: 'No, Save Program Only',
              onOk: () => resolve(true),
              onCancel: () => resolve(false),
            });
          });
        }
      }

      // Sanitize Data
      const ageGroups = (values.ageGroups || []).map(g => ({
        ...g,
        id: g.id || Math.random().toString(36).slice(2),
        startAge: Number(g.startAge),
        endAge: Number(g.endAge),
        joinFee: Number(g.joinFee),
        payAmount: Number(g.payAmount)
      }));

      const categoryFlags = { isSuraksha: false, isMamera: false, isVivah: false, isOther: false };
      if (values.category) categoryFlags[values.category] = true;

      const finalData = {
        ...values,
        ...categoryFlags,
        ageGroups,
        isSelected,
        memberCount: Number(values.memberCount) || 0,
        inactivemembercount: Number(values.inactivemembercount) || 0,
        updatedAt: serverTimestamp(),
      };
      delete finalData.category; // Cleanup before save

      if (mode === 'add') {
        await addDoc(collection(db, "users", user.uid, "programs"), {
          ...finalData,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
        antdMessage.success('Program Created!');
      } else {
        await updateDoc(doc(db, "users", user.uid, "programs", program.id), finalData);
        
        if (shouldUpdateMembers) {
          setUpdatingMembers(true);
          antdMessage.loading({ content: 'Updating members...', key: 'upd_status', duration: 0 });
          const success = await updateMemberFees(program.id, ageGroups);
          success ? antdMessage.success({ content: 'Members updated!', key: 'upd_status' }) 
                  : antdMessage.error({ content: 'Member update failed!', key: 'upd_status' });
        }
        
        // Update Redux
        const newList = programList.map(p => p.id === program.id ? { ...p, ...finalData } : p);
        dispatch(setPrograms(newList));
        antdMessage.success('Program Updated!');
      }

      dispatch(setgetMemberDataChange(true));
      if (onSuccess) onSuccess();
      setIsDrawerOpen(false);

    } catch (err) {
      console.error(err);
      antdMessage.error("Save failed!");
    } finally {
      setLoading(false);
      setUpdatingMembers(false);
    }
  };

  return (
    <Drawer
      title={<Title level={4}>{mode === 'edit' ? <FiEdit2 /> : <FiPlusCircle />} {mode === 'edit' ? 'Edit' : 'New'} Program</Title>}
      open={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      width={550}
      destroyOnHidden={true}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div className="space-y-4 pb-20">
          <Card title="General Details" size="small">
            <Form.Item name="name" label="Program Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="hiname" label="Hindi Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="Category" rules={[{ required: true }]}>
              <Radio.Group options={programCategories} />
            </Form.Item>
                   <Form.Item
                  label="Certificate Note (Hindi)"
                  name="noteLine"
                  rules={[{ required: true, message: 'Please enter note' }]}
                >
                  <Input 
                    placeholder="Enter hindi note for certificate" 
                    className="h-10"
                  />
                </Form.Item>
            <Form.Item name="about" label="Description">
              <TextArea rows={2} />
            </Form.Item>
          </Card>

          <Card title="Member Statistics" size="small">
            <div className="grid grid-cols-2 gap-4">
              <Form.Item 
                name="memberCount" 
                label="Active Members" 
                initialValue={0}
                tooltip="Total active members in this program"
              >
                <InputNumber 
                  className="w-full" 
                  min={0}
                  placeholder="0"
                  prefix={<FiUser className="text-gray-400" />}
                />
              </Form.Item>
              <Form.Item 
                name="inactivemembercount" 
                label="Inactive Members" 
                initialValue={0}
                tooltip="Total inactive members in this program"
              >
                <InputNumber 
                  className="w-full" 
                  min={0}
                  placeholder="0"
                  prefix={<FiUser className="text-gray-400" />}
                />
              </Form.Item>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded-md">
              <Text type="secondary" className="text-sm">
                Total Members: {(form.getFieldValue('memberCount') || 0) + (form.getFieldValue('inactivemembercount') || 0)}
              </Text>
            </div>
          </Card>

          <Card title="Age & Fees" size="small">
            <Form.List name="ageGroups">
              {(fields, { add, remove }) => (
                <div className="space-y-3">
                  {fields.map((field) => (
                    <Card key={field.key} type="inner" size="small" extra={<FiTrash2 className="text-red-500 cursor-pointer" onClick={() => remove(field.name)} />}>
                      <div className="grid grid-cols-2 gap-2">
                        <Form.Item label="Start Age" name={[field.name, 'startAge']}>
                          <InputNumber className="w-full" min={0} />
                        </Form.Item>
                        <Form.Item label="End Age" name={[field.name, 'endAge']}>
                          <InputNumber className="w-full" min={0} />
                        </Form.Item>
                        <Form.Item label="Join Fee" name={[field.name, 'joinFee']}>
                          <InputNumber prefix="₹" className="w-full" min={0} />
                        </Form.Item>
                        <Form.Item label="Pay Amt" name={[field.name, 'payAmount']}>
                          <InputNumber prefix="₹" className="w-full" min={0} />
                        </Form.Item>
                      </div>
                    </Card>
                  ))}
                  <Button type="dashed" block onClick={() => add()} icon={<FiPlusCircle />}>
                    Add Age Range
                  </Button>
                </div>
              )}
            </Form.List>
          </Card>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-end gap-2">
          <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading || updatingMembers}>
            {mode === 'edit' ? <FiSave className="mr-1" /> : <FiPlusCircle className="mr-1" />}
            {mode === 'edit' ? 'Update Program' : 'Create Program'}
          </Button>
        </div>
      </Form>
    </Drawer>
  );
};

export default AddProgramEdit;