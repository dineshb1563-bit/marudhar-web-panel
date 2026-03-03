'use client'
import React, { useState } from 'react';
import { Modal, Form, Input, Upload, Button, message, Card, Tooltip } from 'antd';
import { FiUpload, FiImage, FiPlusCircle, FiEdit2, FiInfo } from 'react-icons/fi';
import { useAuth } from '@/lib/AuthProvider';
import { collection, addDoc } from "firebase/firestore";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const { TextArea } = Input;

// Add dummy data
const dummyData = {
  name: 'Trust Organization Ltd.',
  about: 'A leading trust management organization dedicated to providing comprehensive financial and estate planning services since 1995. We specialize in creating and managing trusts that protect and grow your assets for future generations.',
  logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQW3zR7U8WXN_VBLKy_ZCx4sbkOIqgVYa5uhw&s',
  banner: 'https://png.pngtree.com/thumb_back/fh260/back_pic/02/50/63/71577e1cf59d802.jpg',
  trustStamp: 'https://example.com/trust-stamp.png', // Replace signature with trustStamp
  govtRegNo: '123456789' // Add dummy government registration number
};

const Organization = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { user } = useAuth();

  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must smaller than 2MB!');
    }
    return isImage && isLt2M;
  };

  const handleSubmit = async (values) => {
    if (!user?.uid) {
      message.error("User not authenticated!");
      return;
    }
    try {
      const uploadFileAndGetUrl = async (fileList, field) => {
        if (!fileList || !fileList[0]?.originFileObj) return "";
        const file = fileList[0].originFileObj;
        const storageRef = ref(storage, `organizations/${user.uid}/${field}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      };

      const logoUrl = await uploadFileAndGetUrl(values.logo, "logo");
      const bannerUrl = await uploadFileAndGetUrl(values.banner, "banner");
      const trustStampUrl = await uploadFileAndGetUrl(values.trustStamp, "trustStamp");

      const orgRef = collection(db, "users", user.uid, "organizations");
      await addDoc(orgRef, {
        name: values.name,
        about: values.about,
        govtRegNo: values.govtRegNo, // <-- Save the new field
        logo: logoUrl,
        banner: bannerUrl,
        trustStamp: trustStampUrl,
        createdAt: new Date(),
        createdBy: user.uid,
      });
      message.success('Organization details saved!');
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error("Failed to save organization details");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Organization Settings</h1>
          <p className="text-[var(--gray-300)] mt-1">Manage your organization's profile and information</p>
        </div>
        <Button 
          type="primary"
          size="large"
          icon={<FiPlusCircle className="mr-2" />}
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--primary-blue)] hover:bg-[var(--primary-dark)]"
        >
          Add Organization Info
        </Button>
      </div>

      {/* Organization Information Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Card */}
        <Card 
          title={
            <span className="flex items-center text-lg font-medium">
              <FiInfo className="mr-2 text-[var(--primary-blue)]" /> Basic Information
            </span>
          }
          extra={
            <Tooltip title="Edit Organization Info">
              <Button 
                type="text" 
                icon={<FiEdit2 />} 
                onClick={() => {
                  form.setFieldsValue({ 
                    name: dummyData.name,
                    about: dummyData.about,
                    govtRegNo: dummyData.govtRegNo // <-- Set field for edit
                  });
                  setIsModalOpen(true);
                }}
                className="text-[var(--primary-blue)] hover:text-[var(--primary-dark)]"
              />
            </Tooltip>
          }
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-[var(--gray-300)]">Organization Name</h4>
              <p className="text-[var(--foreground)] text-lg">{dummyData.name}</p>
            </div>
            <div>
              <h4 className="font-medium text-[var(--gray-300)]">About</h4>
              <p className="text-[var(--foreground)]">{dummyData.about}</p>
            </div>
            <div>
              <h4 className="font-medium text-[var(--gray-300)]">Govt Reg No</h4>
              <p className="text-[var(--foreground)]">{dummyData.govtRegNo || "N/A"}</p>
            </div>
          </div>
        </Card>

        {/* Media Assets Card */}
        <Card 
          title={
            <span className="flex items-center text-lg font-medium">
              <FiImage className="mr-2 text-[var(--primary-blue)]" /> Media Assets
            </span>
          }
          extra={
            <Tooltip title="Edit Media Assets">
              <Button 
                type="text" 
                icon={<FiEdit2 />} 
                onClick={() => setIsModalOpen(true)}
                className="text-[var(--primary-blue)] hover:text-[var(--primary-dark)]"
              />
            </Tooltip>
          }
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-[var(--gray-300)]">Logo</h4>
              <div className="w-32 h-32 rounded-lg border-2 border-[var(--gray-200)] flex items-center justify-center">
                <img 
                  src={dummyData.logo} 
                  alt="Organization Logo"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/128?text=Logo';
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-[var(--gray-300)]">Banner</h4>
              <div className="w-full h-32 rounded-lg border-2 border-[var(--gray-200)] flex items-center justify-center bg-[var(--gray-100)]">
                <img 
                  src={dummyData.banner} 
                  alt="Organization Banner"
                  className="max-w-full max-h-full object-cover rounded-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/400x128?text=Banner';
                  }}
                />
              </div>
            </div>
            <div className="col-span-2 space-y-2">
              <h4 className="font-medium text-[var(--gray-300)]">Trust Stamp</h4>
              <div className="w-48 h-24 rounded-lg border-2 border-[var(--gray-200)] flex items-center justify-center bg-white">
                <img 
                  src={dummyData.trustStamp} 
                  alt="Trust Stamp"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/192x96?text=Trust+Stamp';
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        title={<h3 className="text-xl font-semibold text-[var(--foreground)]">Organization Details</h3>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={700}
        className="custom-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="mt-4"
        >
          <div className="grid grid-cols-1 gap-4">
            {/* Basic Info Section */}
            <div className="bg-[var(--gray-50)] p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[var(--gray-400)] mb-3">Basic Information</h4>
              <div className="space-y-4">
                <Form.Item
                  label="Organization Name"
                  name="name"
                  rules={[{ required: true, message: 'Please enter organization name' }]}
                >
                  <Input 
                    placeholder="Enter organization name"
                    className="h-10"
                  />
                </Form.Item>

                <Form.Item
                  label="About Organization"
                  name="about"
                  rules={[{ required: true, message: 'Please enter organization description' }]}
                >
                  <TextArea 
                    placeholder="Enter organization description"
                    rows={3}
                    className="resize-none"
                  />
                </Form.Item>

                <Form.Item
                  label="Govt Reg No"
                  name="govtRegNo"
                  rules={[{ required: true, message: 'Please enter government registration number' }]}
                >
                  <Input 
                    placeholder="Enter government registration number"
                    className="h-10"
                  />
                </Form.Item>
              </div>
            </div>

            {/* Media Section */}
            <div className="bg-[var(--gray-50)] p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[var(--gray-400)] mb-3">Media Assets</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Form.Item
                  label="Logo"
                  name="logo"
                  rules={[{ required: true, message: 'Please upload organization logo' }]}
                >
                  <Upload
                    listType="picture-card"
                    maxCount={1}
                    beforeUpload={beforeUpload}
                    className="logo-uploader"
                  >
                    <div className="flex flex-col items-center">
                      <FiImage size={20} className="text-[var(--gray-300)] mb-1" />
                      <span className="text-xs text-[var(--gray-300)]">Logo</span>
                    </div>
                  </Upload>
                </Form.Item>

                <Form.Item
                  label="Banner"
                  name="banner"
                  rules={[{ required: true, message: 'Please upload banner image' }]}
                >
                  <Upload
                    listType="picture-card"
                    maxCount={1}
                    beforeUpload={beforeUpload}
                    className="banner-uploader"
                  >
                    <div className="flex flex-col items-center">
                      <FiImage size={20} className="text-[var(--gray-300)] mb-1" />
                      <span className="text-xs text-[var(--gray-300)]">Banner</span>
                    </div>
                  </Upload>
                </Form.Item>

                <Form.Item
                  label="Trust Stamp"
                  name="trustStamp"
                  rules={[{ required: true, message: 'Please upload trust stamp' }]}
                >
                  <Upload
                    listType="picture-card"
                    maxCount={1}
                    beforeUpload={beforeUpload}
                    className="stamp-uploader"
                  >
                    <div className="flex flex-col items-center">
                      <FiImage size={20} className="text-[var(--gray-300)] mb-1" />
                      <span className="text-xs text-[var(--gray-300)]">Stamp</span>
                    </div>
                  </Upload>
                </Form.Item>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--gray-200)]">
            <Button 
              onClick={() => setIsModalOpen(false)}
              className="hover:bg-[var(--gray-100)]"
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit"
              className="bg-[var(--primary-blue)] hover:bg-[var(--primary-dark)]"
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Organization;
