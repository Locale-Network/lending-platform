import 'server-only';

import prisma from '@prisma/index';

export async function checkNotice(id: number): Promise<boolean> {
  const notice = await prisma.notice.findUnique({
    where: { id },
  });

  return notice !== null;
}

export async function markNoticeProcessed(id: number): Promise<void> {
  await prisma.notice.create({
    data: { id },
  });
}

export async function getLastProcessedIndex(): Promise<number> {
  const notice = await prisma.notice.findFirst({
    orderBy: { id: 'desc' },
  });

  return notice?.id ?? -1;
}
