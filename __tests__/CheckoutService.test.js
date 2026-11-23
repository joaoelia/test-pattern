import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

describe('CheckoutService', () => {
    const cartaoCredito = 'cartao-teste';

    describe('quando o pagamento falha', () => {
        it('retorna null sem salvar o pedido nem enviar e-mail', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: false })
            };
            const repositoryDummy = { salvar: jest.fn() };
            const emailDummy = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryDummy,
                emailDummy
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBeNull();
            expect(repositoryDummy.salvar).not.toHaveBeenCalled();
            expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        it('retorna o pedido salvo com o total sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const pedidoSalvo = { id: 'pedido-123', totalFinal: 100 };
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true })
            };
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue(pedidoSalvo)
            };
            const emailDummy = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailDummy
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(100, cartaoCredito);
            expect(pedido).toBe(pedidoSalvo);
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        it('cobra o valor com 10% de desconto', async () => {
            // Arrange
            const userPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(userPremium)
                .comItens([new Item('Compra', 200)])
                .build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true })
            };
            const repositoryStub = {
                salvar: jest.fn().mockImplementation(async (pedido) => ({
                    ...pedido,
                    id: 'pedido-premium'
                }))
            };
            const emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
            expect(pedido.totalFinal).toBe(180);
        });

        it('envia o e-mail de aprovação com os dados do pedido', async () => {
            // Arrange
            const userPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(userPremium)
                .comItens([new Item('Compra', 200)])
                .build();
            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true })
            };
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue({ id: 'pedido-premium' })
            };
            const emailMock = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            // Act
            await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido pedido-premium no valor de R$180'
            );
        });
    });
});
