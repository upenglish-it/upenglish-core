import { PartialType } from '@nestjs/swagger';
import { CreateContentProposalDto } from './create-content-proposal.dto';

export class UpdateContentProposalDto extends PartialType(CreateContentProposalDto) {}
