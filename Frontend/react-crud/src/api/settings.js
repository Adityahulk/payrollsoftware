import apiClient from './client';

export const getPayslipSettings = async () => {
  const res = await apiClient.get('/settings/payslip');
  return res.data;
};

export const savePayslipSettings = async (formData) => {
  const res = await apiClient.post('/settings/payslip', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
};
