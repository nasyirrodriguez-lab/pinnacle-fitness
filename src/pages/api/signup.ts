import { addRow } from '@/lib/google'
import { NextApiRequest, NextApiResponse } from 'next'

async function signup(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { firstName, lastName, email, tel, age, membership } = req.body
    await addRow(firstName, lastName, email, tel, age, membership)
    res.status(201).json({})
  } catch (error) {
    console.log(error)
    res.status(500).json({})
  }
}

export default signup
