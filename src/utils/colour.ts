import { LoanApplicationStatus } from '@prisma/client';

export const getLoanStatusStyle = (status: LoanApplicationStatus | undefined) => {
  if (!status) {
    return 'bg-gray-100 text-gray-800';
  }

  const statusStyles: Record<LoanApplicationStatus, string> = {
    APPROVED: 'bg-green-100 text-green-800 hover:bg-green-200',
    PENDING: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    REJECTED: 'bg-red-100 text-red-800 hover:bg-red-200',
    ADDITIONAL_INFO_NEEDED: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    DRAFT: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  };

  return statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800';
};

export const getCreditScoreStyle = (score: number) => {
  if (score >= 300 && score <= 579) {
    return 'bg-red-100 text-red-800 border-red-300';
  } else if (score >= 580 && score <= 669) {
    return 'bg-orange-100 text-orange-800 border-orange-300';
  } else if (score >= 670 && score <= 739) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else if (score >= 740 && score <= 799) {
    return 'bg-lime-100 text-lime-800 border-lime-300';
  } else if (score >= 800 && score <= 850) {
    return 'bg-green-100 text-green-800 border-green-300';
  } else {
    return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};
