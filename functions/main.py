# Importa as bibliotecas necessárias para o Firebase Admin SDK e para funções HTTP
from firebase_admin import credentials, firestore, auth, storage, initialize_app
from firebase_functions import https_fn
from PIL import Image, ImageDraw, ImageFont
import io
import qrcode
import requests
from google.cloud import storage as gcs_storage
import google.auth
import json
# ...

# Inicializa o Firebase Admin SDK com as credenciais do arquivo
cred = credentials.Certificate('service-account.json')
initialize_app(credential=cred)

# Inicializa as credenciais para o Google Cloud Storage
gcs_credentials, project = google.auth.load_credentials_from_file('service-account.json')
gcs_client = gcs_storage.Client(project=project, credentials=gcs_credentials)

# Obtém a instância do cliente do Firestore para interagir com o banco de dados
db = firestore.client()

@https_fn.on_request()
def deleteUser(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud Function para excluir um usuário do Firestore e do Firebase Authentication.
    """
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if req.method == 'OPTIONS':
        return https_fn.Response('', headers=headers)

    if req.method == 'POST':
        try:
            request_json = req.get_json(silent=True)
            if not request_json or 'uid' not in request_json:
                raise ValueError('Requisição inválida. O corpo JSON deve conter um "uid".')
            
            user_uid = request_json['uid']

            # 1. Exclui o documento do usuário no Firestore
            db.collection('usuarios').document(user_uid).delete()
            
            # 2. Exclui o usuário do Firebase Authentication
            auth.delete_user(user_uid)
            
            response_data = {'status': 'success', 'message': f'Usuário {user_uid} excluído com sucesso.'}
            return https_fn.Response(response_data, status=200, headers=headers)
        
        except ValueError as e:
            response_data = {'status': 'error', 'message': str(e)}
            return https_fn.Response(response_data, status=400, headers=headers)
        except auth.AuthError as e:
            response_data = {'status': 'error', 'message': f'Erro do Firebase Auth: {str(e)}'}
            return https_fn.Response(response_data, status=400, headers=headers)
        except Exception as e:
            response_data = {'status': 'error', 'message': f'Erro ao excluir usuário: {str(e)}'}
            return https_fn.Response(response_data, status=500, headers=headers)
    else:
        response_data = {'status': 'error', 'message': 'Método não permitido. Use POST ou OPTIONS.'}
        return https_fn.Response(response_data, status=405, headers=headers)

@https_fn.on_request()
def generateAndStoreQrCode(req: https_fn.Request) -> https_fn.Response:
    """
    Gera um QR Code e o salva no Firebase Storage.
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if req.method == 'OPTIONS':
        return https_fn.Response('', headers=headers)

    try:
        data = req.get_json(silent=True)
        if not data or 'eventId' not in data or 'nome' not in data:
            raise ValueError('Dados inválidos. Espera-se "eventId" e "nome".')
        
        event_id = data['eventId']
        guest_name = data['nome']
        
        # 1. Gerar o QR Code
        qr_data = '{"eventId": "' + event_id + '", "nome": "' + guest_name + '"}'
        qr_gen = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr_gen.add_data(qr_data)
        qr_gen.make(fit=True)
        qr_image = qr_gen.make_image(fill_color="black", back_color="white")
        
        # 2. Converter a imagem para bytes
        img_buffer = io.BytesIO()
        qr_image.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        
        # 3. Fazer o upload para o Firebase Storage
        bucket_name = 'kd-qr-codes-checkin-eventos.firebasestorage.app'
        bucket = gcs_client.bucket(bucket_name)
        blob_path = f'qrcodes/{event_id}/{guest_name}.png'
        blob = bucket.blob(blob_path)
        
        # Define o tipo de conteúdo e torna o arquivo público
        blob.upload_from_file(img_buffer, content_type='image/png')
        blob.make_public()
        
        # 4. Retornar a URL pública
        public_url = blob.public_url
        return https_fn.Response(json.dumps({'public_url': public_url}), mimetype="application/json", status=200, headers=headers)
        
    except ValueError as e:
        return https_fn.Response(json.dumps({'error': str(e)}), mimetype="application/json", status=400, headers=headers)
    except Exception as e:
        return https_fn.Response({'error': 'Erro interno do servidor: ' + str(e)}, status=500, headers=headers)


@https_fn.on_request()
def generateArt(req: https_fn.Request) -> https_fn.Response:
    """
    Cloud Function para gerar a arte personalizada com o QR Code.
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if req.method == 'OPTIONS':
        return https_fn.Response('', headers=headers)

    try:
        data = req.get_json(silent=True)
        if not data or 'eventId' not in data or 'nome' not in data:
            raise ValueError('Dados inválidos. Espera-se "eventId" e "nome".')

        event_id = data['eventId']
        guest_name = data['nome']

        # 1. Obter a URL do template do Firestore
        event_doc_ref = db.collection('eventos').document(event_id)
        event_doc = event_doc_ref.get()

        if not event_doc.exists or 'artTemplateUrl' not in event_doc.to_dict():
            raise ValueError('Template de arte não encontrado para este evento.')
            
        template_url = event_doc.to_dict()['artTemplateUrl']

        # 2. Baixar o template de arte da URL
        template_response = requests.get(template_url)
        template_image = Image.open(io.BytesIO(template_response.content))

        # 3. Gerar o QR Code com a biblioteca 'qrcode'
        qr_data = '{"eventId": "' + event_id + '", "nome": "' + guest_name + '"}'
        qr_gen = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr_gen.add_data(qr_data)
        qr_gen.make(fit=True)
        qr_image = qr_gen.make_image(fill_color="black", back_color="white")
        
        # 4. Redimensionar o QR Code para um tamanho específico
        qr_image_resized = qr_image.resize((415, 415))

        # 5. Sobrepor o QR Code no template
        # Posição (x, y) de onde o QR Code será colado na imagem.
        position_x = 337
        position_y = 1257
        qr_width = 415
        qr_height = 415
        
        position_x_final = position_x + (415 - qr_width) // 2
        position_y_final = position_y + (415 - qr_height) // 2

        template_image.paste(qr_image_resized, (position_x_final, position_y_final))

        # 6. Salvar a imagem final em um buffer de bytes
        img_buffer = io.BytesIO()
        template_image.save(img_buffer, format="PNG")
        img_buffer.seek(0)

        return https_fn.Response(img_buffer.getvalue(), mimetype="image/png", status=200, headers=headers)

    except ValueError as e:
        return https_fn.Response({'error': str(e)}, status=400, headers=headers)
    except Exception as e:
        return https_fn.Response({'error': 'Erro interno do servidor: ' + str(e)}, status=500, headers=headers)