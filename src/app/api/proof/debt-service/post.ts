import { Context, Proof, verifyProof } from '@reclaimprotocol/js-sdk';
import { NextResponse } from 'next/server';
import { getLoanApplication } from '@/services/db/loan-applications/borrower';
import prisma from '@prisma/index';

import { Contract, Wallet, JsonRpcProvider, getBytes, hexlify } from 'ethers';
import CartesiBase from '@cartesi/rollups/export/abi/base.json';

// called as part of Reclaim's Debt Service flow

export async function POST(req: Request) {
  try {
    const rawProof = await req.text();

    const decodedProof = decodeURIComponent(rawProof);

    const proof = JSON.parse(decodedProof) as Proof;

    const isProofVerified = await verifyProof(proof);
    if (!isProofVerified) {
      return NextResponse.json(
        {
          message: 'Proof verification failed',
        },
        { status: 400 }
      );
    }

    const rawContext = proof.claimData.context;
    const context = JSON.parse(rawContext) as Context & {
      extractedParameters: Record<string, string>;
    };

    console.log('context', context);

    const loanApplicationId = context.extractedParameters.URL_PARAMS_1;
    const transactions = context.extractedParameters.transactions ?? [];

    const loanApplication = await getLoanApplication({
      loanApplicationId,
    });

    if (!loanApplication) {
      return NextResponse.json(
        {
          message: 'Loan application not found',
        },
        { status: 404 }
      );
    }

    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL as string);

    const signer = new Wallet(process.env.CARTESI_PRIVATE_KEY as string, provider);

    signer.connect(provider);

    const contract = new Contract(
      CartesiBase.contracts.InputBox.address,
      CartesiBase.contracts.InputBox.abi,
      signer
    );

    // Convert context to UTF-8 encoded bytes
    const contextBytes = new TextEncoder().encode(JSON.stringify(context));

    await contract.addInput(process.env.CARTESI_DAPP_ADDRESS as string, hexlify(contextBytes));

    // Check if proof already exists
    const existingProof = await prisma.debtServiceProof.findUnique({
      where: {
        id: proof.identifier,
      },
    });

    // If proof already exists, return success
    if (existingProof) {
      return NextResponse.json(
        {
          message: 'Proof verified',
        },
        { status: 200 }
      );
    }

    await prisma.debtService.create({
      data: {
        loanApplication: {
          connect: {
            id: loanApplicationId,
          },
        },
        transactionCount: transactions.length,
        debtServiceProof: {
          create: {
            id: proof.identifier,
            proof: JSON.stringify(proof),
            context: JSON.stringify(context),
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: 'Proof verified',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        message: 'Error verifying proof',
      },
      { status: 500 }
    );
  }
}
